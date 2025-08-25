import React, { useState, useEffect, useCallback, useRef } from "react";
import { io } from "socket.io-client";
import QRCode from "qrcode";
import { encryptText, decryptText } from "./crypto.js";
import { HistoryList } from "./components/HistoryList.jsx";
import { SharePanel } from "./components/SharePanel.jsx";
import { useClipboardFormatting } from "./hooks/useClipboardFormatting.js";
import { MonacoClipboard } from "./components/MonacoClipboard.jsx";
import toast, { Toaster } from "react-hot-toast";

// Lazy-load prettier + plugins only when needed
const prettierBundleRef = { current: null };
async function ensurePrettier() {
  if (prettierBundleRef.current) return prettierBundleRef.current;
  const [prettier, babel, ts, estree] = await Promise.all([
    import("prettier/standalone"),
    import("prettier/plugins/babel"),
    import("prettier/plugins/typescript"),
    import("prettier/plugins/estree"),
  ]);
  prettierBundleRef.current = {
    prettier: prettier.default,
    plugins: [babel, ts, estree].map((m) => m.default || m),
  };
  return prettierBundleRef.current;
}

// Storage key for auto rejoin
const STORAGE_KEY = "oc_last_session_v2";

export default function App() {
  // Session/core state
  const [code, setCode] = useState(null);
  const [link, setLink] = useState(null);
  const [secret, setSecret] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("idle"); // idle|connected|reconnecting|disconnected
  // Content
  const [clipboard, setClipboard] = useState("");
  const [version, setVersion] = useState(null);
  // History
  const [history, setHistory] = useState([]); // decrypted previews
  const [allowHistory, setAllowHistory] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [expandedHistory, setExpandedHistory] = useState(new Set());
  const [editingVersion, setEditingVersion] = useState(null);
  const [saveError, setSaveError] = useState(null);
  // Prefs/UI
  const [lang, setLang] = useState("plain");
  const [autoFormat, setAutoFormat] = useState(true);
  const [showShare, setShowShare] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [copyState, setCopyState] = useState({
    code: false,
    link: false,
    clipboard: false,
  });
  const [autoSynced, setAutoSynced] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false); // mobile overlay
  // Join helpers & persistence
  const [joinCode, setJoinCode] = useState("");
  const [joinLink, setJoinLink] = useState("");
  const [lastSession, setLastSession] = useState(null);
  const [attemptingAutoRejoin, setAttemptingAutoRejoin] = useState(false);
  // react-hot-toast replaces custom toasts

  // Refs (mutable helpers)
  const socketRef = useRef(null);
  const skipNextAutosave = useRef(false);
  const firstVersionRef = useRef(null);
  const manualLeaveRef = useRef(false);
  const textareaRef = useRef(null); // legacy ref; reused for focusing via Monaco wrapper
  const originalCipherRef = useRef(null);
  const originalPlainRef = useRef(null);

  // Derived secret builder
  const makeSecret = (c, t) => `${c}:${t}`;

  // Persist / load session
  const persistSession = (c, token) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ code: c, linkToken: token })
      );
    } catch {}
    setLastSession({ code: c, linkToken: token });
  };
  const loadSession = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setLastSession(JSON.parse(raw));
    } catch {}
  };

  // Socket setup
  const setupSocket = useCallback((room, secretVal) => {
    const url =
      import.meta.env.VITE_SOCKET_URL ||
      `${window.location.protocol}//${window.location.hostname}:${import.meta.env.VITE_BACKEND_PORT || 4000}`;
    const s = io(url, { transports: ["websocket"], reconnection: true });
    socketRef.current = s;
    setConnectionStatus("idle");
    s.on("connect", () => {
      setConnectionStatus("connected");
      s.emit("join", { room });
    });
    s.on("reconnect_attempt", () => setConnectionStatus("reconnecting"));
    s.on("disconnect", () => setConnectionStatus("disconnected"));
    s.on("connect_error", () => setConnectionStatus("disconnected"));
    s.on("clipboard:updated", async ({ ciphertext, version }) => {
      setVersion(version);
      const text = await decryptText(secretVal, ciphertext);
      if (text != null) {
        setClipboard((prev) => (prev === text ? prev : text));
      }
      fetchHistory(room, secretVal);
    });
  }, []);

  // Backend actions
  async function createSession() {
    if (code) return;
    const r = await window.__convexClient
      ?.mutation("functions:createSession", {})
      .catch(() => null);
    if (!r) return alert("Failed to create session");
    const c = r.code;
    const token = r.linkToken;
    const sec = makeSecret(c, token);
    setCode(c);
    setLink(`${window.location.origin}/join/${token}`);
    setSecret(sec);
    setAllowHistory(true); // default
    persistSession(c, token);
    setupSocket(c, sec);
    if (clipboard.trim()) setTimeout(() => syncUpdate(c, sec, true), 60);
    fetchHistory(c, sec);
    fetchLatest(c, sec);
    setShowShare(true);
    toast.success("Session created");
  }

  async function joinByCode() {
    const codeVal = joinCode.trim();
    if (codeVal.length !== 5) return alert("Need 5-char code");
    const r = await window.__convexClient
      ?.query("functions:getSession", { code: codeVal })
      .catch(() => null);
    if (!r) return alert("Not found");
    const sec = makeSecret(r.code, r.linkToken);
    setCode(r.code);
    setLink(`${window.location.origin}/join/${r.linkToken}`);
    setSecret(sec);
    if (r.currentLang) setLang(r.currentLang);
    if (typeof r.autoFormat === "boolean") setAutoFormat(r.autoFormat);
    setAllowHistory(r.allowHistory);
    persistSession(r.code, r.linkToken);
    setupSocket(r.code, sec);
    fetchHistory(r.code, sec);
    fetchLatest(r.code, sec);
    toast.success("Joined session " + r.code);
  }

  async function joinByLink() {
    if (!joinLink.trim()) return;
    const token = joinLink.trim().split("/").pop();
    if (!token) return alert("Invalid link");
    const r = await window.__convexClient
      ?.query("functions:joinByToken", { linkToken: token })
      .catch(() => null);
    if (!r) return alert("Not found");
    const sec = makeSecret(r.code, r.linkToken);
    setCode(r.code);
    setLink(`${window.location.origin}/join/${token}`);
    setSecret(sec);
    setAllowHistory(r.allowHistory);
    if (r.currentLang) setLang(r.currentLang);
    if (typeof r.autoFormat === "boolean") setAutoFormat(r.autoFormat);
    persistSession(r.code, r.linkToken);
    setupSocket(r.code, sec);
    fetchHistory(r.code, sec);
    toast.success("Joined via link");
  }

  async function fetchHistory(c = code, sec = secret) {
    if (!c) return;
    try {
      const raw =
        (await window.__convexClient?.query("functions:getHistory", {
          code: c,
        })) || [];
      if (sec) {
        const items = await Promise.all(
          raw.map(async (it) => {
            try {
              const text = await decryptText(sec, it.ciphertext);
              const lines = (text || "").split(/\r?\n/);
              let acc = [],
                total = 0;
              for (let i = 0; i < lines.length && i < 3; i++) {
                const ln = lines[i];
                if (total + ln.length > 120) {
                  acc.push(ln.slice(0, 120 - total) + "…");
                  break;
                }
                acc.push(ln);
                total += ln.length;
              }
              return {
                ...it,
                preview: acc.join("\n"),
                lang: it.lang || "plain",
              };
            } catch {
              return { ...it, preview: "(decrypt error)" };
            }
          })
        );
        setHistory(items);
        // preserve expanded items if still present
        setExpandedHistory(
          (prev) =>
            new Set([...prev].filter((v) => items.some((i) => i.version === v)))
        );
        if (items.length && !firstVersionRef.current)
          firstVersionRef.current = items.reduce(
            (m, a) => Math.min(m, a.version),
            items[0].version
          );
      } else {
        setHistory(raw.map((it) => ({ ...it, preview: "(loading...)" })));
      }
      const meta = await window.__convexClient
        ?.query("functions:getSession", { code: c })
        .catch(() => null);
      if (meta) {
        setAllowHistory(meta.allowHistory);
        if (meta.currentLang) setLang(meta.currentLang);
        if (typeof meta.autoFormat === "boolean")
          setAutoFormat(meta.autoFormat);
      }
    } catch {
      /* ignore */
      toast.error("History fetch failed");
    }
  }

  async function fetchLatest(c = code, sec = secret) {
    if (!c || !sec) return;
    try {
      const p = await window.__convexClient?.query(
        "functions:latestCiphertext",
        { code: c }
      );
      if (!p) return;
      setVersion(p.version);
      const text = await decryptText(sec, p.ciphertext);
      if (text != null) {
        // Preserve user's local draft on first load: only set if empty
        if (!clipboard || !clipboard.trim()) {
          skipNextAutosave.current = true;
          setClipboard(text);
        }
      }
    } catch {
      /* ignore */
      toast.error("Latest fetch failed");
    }
  }

  async function syncUpdate(
    explicitCode = code,
    explicitSecret = secret,
    silent = false
  ) {
    if (!explicitCode || !explicitSecret) return;
    const ciphertext = await encryptText(explicitSecret, clipboard);
    const replaceLatest =
      allowHistory && firstVersionRef.current != null && version != null; // simple heuristic
    const r = await window.__convexClient
      ?.mutation("functions:updateClipboard", {
        code: explicitCode,
        ciphertext,
        replaceLatest,
        lang,
      })
      .catch(() => null);
    if (!r) return;
    setVersion(r.version);
    if (!firstVersionRef.current) firstVersionRef.current = r.version;
    socketRef.current?.emit("clipboard:update", {
      room: explicitCode,
      ciphertext,
      version: r.version,
    });
    if (!silent) fetchHistory(explicitCode, explicitSecret);
    setAutoSynced(true);
    setTimeout(() => setAutoSynced(false), 1500);
    toast.success("Synced v" + r.version);
  }

  async function restore(item) {
    const text = await decryptText(secret, item.ciphertext);
    if (text != null) {
      skipNextAutosave.current = true;
      setClipboard(text);
      if (item.lang && item.lang !== lang) setLang(item.lang);
      toast("Version " + item.version + " restored");
    }
  }

  async function del(item) {
    setHistory((h) => h.filter((x) => x.version !== item.version));
    try {
      await window.__convexClient?.mutation("functions:deleteHistory", {
        code,
        version: item.version,
      });
      fetchHistory();
    } catch {
      fetchHistory();
    }
    setExpandedHistory((prev) => {
      const n = new Set(prev);
      n.delete(item.version);
      return n;
    });
    toast("Deleted v" + item.version);
  }

  function toggleSelect(v) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(v) ? n.delete(v) : n.add(v);
      return n;
    });
  }

  async function deleteSelected() {
    if (!selected.size) return;
    const versions = [...selected];
    setHistory((h) => h.filter((i) => !selected.has(i.version)));
    await window.__convexClient
      ?.mutation("functions:deleteHistoryBatch", { code, versions })
      .catch(() => {});
    setSelected(new Set());
    fetchHistory();
    setExpandedHistory((prev) => {
      const n = new Set(prev);
      versions.forEach((v) => n.delete(v));
      return n;
    });
    toast("Deleted " + versions.length + " items");
  }

  async function edit(item) {
    await restore(item);
    setTimeout(() => textareaRef.current?.focus(), 20);
    setEditingVersion(item.version);
    originalCipherRef.current = item.ciphertext;
    setTimeout(() => {
      originalPlainRef.current = clipboard;
    }, 25);
    toast("Editing v" + item.version);
  }

  function cancelEdit() {
    if (editingVersion == null) return;
    (async () => {
      try {
        const t = await decryptText(secret, originalCipherRef.current);
        if (t != null) setClipboard(t);
      } catch {}
      setEditingVersion(null);
      originalCipherRef.current = null;
      originalPlainRef.current = null;
    })();
    toast("Edit cancelled");
  }

  async function toggleExpand(item) {
    setExpandedHistory((prev) => {
      const n = new Set(prev);
      if (n.has(item.version)) {
        n.delete(item.version);
        return n;
      }
      n.add(item.version);
      return n;
    });
    // If we haven't loaded full text yet (preview only), decrypt and replace preview with full (non-truncated) in-place.
    if (secret) {
      try {
        const full = await decryptText(secret, item.ciphertext);
        if (full != null) {
          setHistory((h) =>
            h.map((it) =>
              it.version === item.version ? { ...it, preview: full } : it
            )
          );
        }
      } catch {
        /* ignore */
      }
    }
    toast(
      (expandedHistory.has(item.version) ? "Collapsed " : "Expanded ") +
        "v" +
        item.version
    );
  }

  async function saveEdit() {
    if (editingVersion == null || !code) return;
    try {
      setSaveError(null);
      const ciphertext = await encryptText(secret, clipboard);
      const resp = await window.__convexClient
        ?.mutation("updateHistoryVersion:updateHistoryVersion", {
          code,
          version: editingVersion,
          ciphertext,
          lang,
        })
        .catch((e) => {
          throw e;
        });
      if (resp && resp.missing) {
        setSaveError("Original version missing.");
        setEditingVersion(null);
        toast.error("Cannot save: original missing");
        return;
      }
      socketRef.current?.emit("clipboard:update", {
        room: code,
        ciphertext,
        version: editingVersion,
      });
      await fetchHistory(code, secret);
      setEditingVersion(null);
      setAutoSynced(true);
      setTimeout(() => setAutoSynced(false), 1300);
      toast.success("Saved edit v" + editingVersion);
    } catch (e) {
      setSaveError(e?.message || "Save failed");
      toast.error("Save failed");
    }
  }

  async function toggleHistory() {
    await window.__convexClient
      ?.mutation("functions:toggleHistory", { code })
      .catch(() => {});
    fetchHistory();
    toast("History " + (!allowHistory ? "enabled" : "disabled"));
  }

  function leave({ forget = false } = {}) {
    manualLeaveRef.current = true;
    try {
      socketRef.current?.disconnect();
    } catch {}
    socketRef.current = null;
    setCode(null);
    setLink(null);
    setSecret(null);
    setHistory([]);
    setVersion(null);
    setConnectionStatus("idle");
    setSelected(new Set());
    setEditingVersion(null);
    if (forget) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
      setLastSession(null);
    }
    toast("Left session" + (forget ? " (forgot)" : ""));
  }

  async function rejoin(auto = false) {
    if (!lastSession?.code) return;
    const c = lastSession.code;
    try {
      setAttemptingAutoRejoin(auto);
      const r = await window.__convexClient
        ?.query("functions:getSession", { code: c })
        .catch(() => null);
      if (!r) throw new Error("not found");
      const linkToken = r.linkToken || lastSession.linkToken;
      const sec = makeSecret(c, linkToken);
      setCode(c);
      setLink(`${window.location.origin}/join/${linkToken}`);
      setSecret(sec);
      setAllowHistory(r.allowHistory);
      setupSocket(c, sec);
      fetchHistory(c, sec);
      toast.success("Rejoined " + c);
    } catch {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
      setLastSession(null);
      toast.error("Rejoin failed");
    } finally {
      setAttemptingAutoRejoin(false);
    }
  }

  // Formatting hook
  const handlePaste = useClipboardFormatting({
    lang,
    autoFormat,
    setClipboard,
    ensurePrettier,
  });

  // Effects
  useEffect(loadSession, []);
  useEffect(() => {
    if (
      !code &&
      lastSession &&
      !attemptingAutoRejoin &&
      !manualLeaveRef.current
    ) {
      rejoin(true);
    }
  }, [lastSession, code, attemptingAutoRejoin]);
  useEffect(() => {
    if (!code) return;
    if (editingVersion != null) return;
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false;
      return;
    }
    const h = setTimeout(() => {
      if (clipboard.trim()) syncUpdate();
    }, 1400);
    return () => clearTimeout(h);
  }, [clipboard, editingVersion, code, lang, autoFormat]);
  useEffect(() => {
    let active = true;
    (async () => {
      if (link && showShare) {
        try {
          const d = await QRCode.toDataURL(link, {
            width: 200,
            margin: 1,
            color: { dark: "#1c2733", light: "#ffffff" },
          });
          if (active) setQrDataUrl(d);
        } catch {
          if (active) setQrDataUrl(null);
        }
      } else {
        setQrDataUrl(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [link, showShare]);
  // Detect /join/<token> deep link once (must be outside conditional render for hooks rule)
  useEffect(() => {
    if (code) return; // already in a session
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts[0] === "join" && parts[1] && !joinLink) {
      const token = parts[1];
      const fullLink = `${window.location.origin}/join/${token}`;
      setJoinLink(fullLink);
      (async () => {
        try {
          const r = await window.__convexClient?.query(
            "functions:joinByToken",
            { linkToken: token }
          );
          if (!r || code) return;
          const sec = makeSecret(r.code, r.linkToken);
          setCode(r.code);
          setLink(fullLink);
          setSecret(sec);
          setAllowHistory(r.allowHistory);
          setupSocket(r.code, sec);
          fetchHistory(r.code, sec);
        } catch {
          /* ignore */
        }
      })();
    }
  }, [code, joinLink]);

  // Copy helper (fallback included)
  function copy(value, key) {
    const mark = () => {
      setCopyState((s) => ({ ...s, [key]: true }));
      setTimeout(() => setCopyState((s) => ({ ...s, [key]: false })), 1200);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(value)
        .then(mark)
        .catch(() => {
          fallback();
          mark();
        });
    } else {
      fallback();
      mark();
    }
    function fallback() {
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {}
      document.body.removeChild(ta);
    }
  }

  // Landing / pre-session screen
  if (!code) {
    return (
      <div className="landing">
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#1f2a36",
              color: "#c9d1d9",
              border: "1px solid #2b3947",
            },
          }}
        />
        <h1>Online Clipboard</h1>
        <p className="lead">
          Type or paste below. Create a session to sync securely across devices
          (end‑to‑end encrypted).
        </p>
        <div className="card">
          <h2>Draft Clipboard</h2>
          <div className="prefs-bar">
            <select value={lang} onChange={(e) => setLang(e.target.value)}>
              <option value="plain">Plain</option>
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
              <option value="json">JSON</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="csharp">C#</option>
              <option value="cpp">C++</option>
              <option value="go">Go</option>
              <option value="rust">Rust</option>
              <option value="sql">SQL</option>
            </select>
            <label className="chk">
              <input
                type="checkbox"
                checked={autoFormat}
                onChange={(e) => setAutoFormat(e.target.checked)}
              />{" "}
              Auto-format
            </label>
          </div>
          <div className="landing-editor">
            <MonacoClipboard
              ref={textareaRef}
              value={clipboard}
              lang={lang}
              onChange={(v) => setClipboard(v)}
              editingVersion={null}
              onPaste={handlePaste}
              options={{formatOnPaste: true,formatOnType: true, autoIndent: "full"}}
            />
          </div>
          <div className="actions">
            <button onClick={createSession} disabled={!clipboard.trim()}>
              Create Share Session
            </button>
            <button className="secondary" onClick={() => setClipboard("")}>
              Clear
            </button>
          </div>
          <div className="divider" />
          <h2>Join Existing</h2>
          <div className="join-row">
            <input
              placeholder="5-char code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              maxLength={5}
            />
            <button
              className="secondary"
              onClick={joinByCode}
              disabled={joinCode.trim().length !== 5}
            >
              Join by Code
            </button>
          </div>
          <div className="join-row">
            <input
              placeholder="Paste sharable link"
              value={joinLink}
              onChange={(e) => setJoinLink(e.target.value)}
            />
            <button
              className="secondary"
              onClick={joinByLink}
              disabled={!joinLink.trim()}
            >
              Join by Link
            </button>
          </div>
          {lastSession?.code && (
            <div className="prev-session">
              <p className="muted">
                Previous session: <strong>{lastSession.code}</strong>
              </p>
              <div className="actions">
                <button
                  onClick={() => rejoin(false)}
                  disabled={attemptingAutoRejoin}
                >
                  {attemptingAutoRejoin ? "Rejoining..." : "Rejoin"}
                </button>
                <button
                  className="secondary"
                  onClick={() => {
                    try {
                      localStorage.removeItem(STORAGE_KEY);
                    } catch {}
                    setLastSession(null);
                  }}
                >
                  Forget
                </button>
              </div>
            </div>
          )}
          <p className="hint">
            No data leaves your browser until you create or join a session.
          </p>
        </div>
      </div>
    );
  }

  // Shared session screen
  return (
    <div className="session full-viewport">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#1f2a36",
            color: "#c9d1d9",
            border: "1px solid #2b3947",
          },
        }}
      />
      {connectionStatus !== "connected" && code && (
        <div className={`conn-banner ${connectionStatus}`}>
          <strong>
            {connectionStatus === "reconnecting" && "Reconnecting..."}
            {connectionStatus === "disconnected" && "Disconnected"}
            {connectionStatus === "idle" && "Connecting..."}
          </strong>
          <div className="right">
            <button
              className="secondary mini"
              onClick={() => {
                if (socketRef.current) {
                  try {
                    socketRef.current.connect();
                  } catch {}
                } else if (lastSession) {
                  rejoin();
                }
              }}
            >
              Retry
            </button>
            <button className="secondary mini" onClick={() => leave()}>
              Leave
            </button>
            <button
              className="secondary mini"
              onClick={() => leave({ forget: true })}
            >
              Forget
            </button>
          </div>
        </div>
      )}
      <div className="layout">
        <div className="main-card">
          <div className="top-row-mobile">
            <button
              className="secondary mini show-history-btn"
              onClick={() => setShowHistoryDrawer(true)}
            >
              History
            </button>
          </div>
          <div className="editor-header">
            <h2>Shared Clipboard</h2>
            <div className="editor-prefs">
              <select
                value={lang}
                onChange={async (e) => {
                  const newLang = e.target.value;
                  setLang(newLang);
                  try {
                    await window.__convexClient?.mutation(
                      "functions:updateSessionPrefs",
                      { code, lang: newLang, autoFormat }
                    );
                  } catch {}
                }}
              >
                <option value="plain">Plain</option>
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="json">JSON</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="csharp">C#</option>
                <option value="cpp">C++</option>
                <option value="go">Go</option>
                <option value="rust">Rust</option>
                <option value="sql">SQL</option>
              </select>
              <label className="chk mini">
                <input
                  type="checkbox"
                  checked={autoFormat}
                  onChange={async (e) => {
                    const v = e.target.checked;
                    setAutoFormat(v);
                    try {
                      await window.__convexClient?.mutation(
                        "functions:updateSessionPrefs",
                        { code, lang, autoFormat: v }
                      );
                    } catch {}
                  }}
                />
                Fmt
              </label>
            </div>
          </div>
          <div className="shared-editor">
            <MonacoClipboard
              ref={textareaRef}
              value={clipboard}
              lang={lang}
              onChange={(v) => setClipboard(v)}
              editingVersion={editingVersion}
              onSaveEdit={saveEdit}
              onCancelEdit={cancelEdit}
              onPaste={handlePaste}
            />
          </div>
          <div className="status-bar">
            <span className="pill">v{version ?? 0}</span>
            {editingVersion != null && (
              <span className="pill warn">Editing v{editingVersion}</span>
            )}
            {editingVersion != null &&
              originalPlainRef.current != null &&
              clipboard !== originalPlainRef.current && (
                <span className="pill dirty">Unsaved</span>
              )}
            {autoSynced && <span className="pill good">Synced</span>}
            <span className="pill toggle" onClick={toggleHistory}>
              {allowHistory ? "History On" : "History Off"}
            </span>
            <span className="muted flex1 right">Autosaves while you type</span>
          </div>
          {saveError && editingVersion == null && (
            <div className="error-box">Save error: {saveError}</div>
          )}
          {editingVersion != null && (
            <div className="edit-hint">
              Editing version {editingVersion}. Ctrl/Cmd+Enter = Save, Esc =
              Cancel.
            </div>
          )}
          <div className="actions wrap">
            <button
              onClick={() => syncUpdate()}
              disabled={editingVersion != null}
            >
              Force Sync
            </button>
            {editingVersion != null && (
              <>
                <button onClick={saveEdit} className="good">
                  Save Edit
                </button>
                <button className="secondary" onClick={cancelEdit}>
                  Cancel Edit
                </button>
              </>
            )}
            <button className="secondary" onClick={() => fetchHistory()}>
              Refresh History
            </button>
            <button
              className="secondary"
              onClick={() => setShowShare((p) => !p)}
            >
              {showShare ? "Hide Share" : "Show Share"}
            </button>
            <button
              className="secondary"
              onClick={() => copy(clipboard, "clipboard")}
            >
              {copyState.clipboard ? "Copied" : "Copy Text"}
            </button>
            <button className="secondary" onClick={() => leave()}>
              Leave
            </button>
            <button
              className="secondary"
              onClick={() => leave({ forget: true })}
            >
              Leave & Forget
            </button>
          </div>
          {showShare && (
            <SharePanel
              code={code}
              link={link}
              qrDataUrl={qrDataUrl}
              copyState={copyState}
              copy={copy}
              onLeave={() => leave()}
              onForget={() => leave({ forget: true })}
            />
          )}
        </div>
        <div className="side-card hide-on-narrow">
          <div className="side-head">
            <h2>History</h2>
            <div className="side-actions">
              <button className="secondary mini" onClick={() => fetchHistory()}>
                Refresh
              </button>
              <button
                className="secondary mini"
                disabled={!selected.size}
                onClick={deleteSelected}
              >
                Del Sel {selected.size || ""}
              </button>
            </div>
          </div>
          <div className="side-meta">
            <span className="tiny muted">Items: {history.length}</span>
            <span className="tiny muted">Lang: {lang}</span>
          </div>
          <div className="history-scroll">
            <HistoryList
              items={history}
              selected={selected}
              expanded={expandedHistory}
              onToggleSelect={toggleSelect}
              onRestore={restore}
              onEdit={edit}
              onDelete={del}
              onToggleExpand={toggleExpand}
              editingVersion={editingVersion}
            />
          </div>
        </div>
      </div>
      {showHistoryDrawer && (
        <div className="history-drawer">
          <div className="drawer-head">
            <strong>History</strong>
            <div className="drawer-actions">
              <button className="secondary mini" onClick={() => fetchHistory()}>
                Refresh
              </button>
              <button
                className="secondary mini"
                disabled={!selected.size}
                onClick={deleteSelected}
              >
                Del Sel {selected.size || ""}
              </button>
              <button
                className="secondary mini"
                onClick={() => setShowHistoryDrawer(false)}
              >
                Close
              </button>
            </div>
          </div>
          <div className="drawer-body">
            <HistoryList
              items={history}
              selected={selected}
              expanded={expandedHistory}
              onToggleSelect={toggleSelect}
              onRestore={(item) => {
                restore(item);
                setShowHistoryDrawer(false);
              }}
              onEdit={(item) => {
                edit(item);
                setShowHistoryDrawer(false);
              }}
              onDelete={del}
              onToggleExpand={toggleExpand}
              editingVersion={editingVersion}
              maxLines={4}
            />
          </div>
        </div>
      )}
    </div>
  );
}
