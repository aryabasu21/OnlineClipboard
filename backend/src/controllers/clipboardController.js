import ClipboardSession from "../models/ClipboardSession.js";
import { generateSessionCode, generateLinkToken } from "../utils/generate.js";

const SESSION_TTL_HOURS = 24; // can tune

export async function createSession(req, res) {
  try {
    const code = generateSessionCode();
    const linkToken = generateLinkToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000);
    const session = await ClipboardSession.create({
      code,
      linkToken,
      expiresAt,
      history: [],
      latest: null,
    });
  // Prefer explicit public base URL (e.g., http://192.168.1.42:4000) for LAN/mobile testing.
  const frontBase = process.env.FRONTEND_BASE_URL?.replace(/\/$/, '');
  const base = frontBase || process.env.PUBLIC_BASE_URL?.replace(/\/$/, '') || `${req.protocol}://${req.get("host")}`;
  return res.json({ code, link: `${base}/join/${linkToken}` });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "FAILED_CREATE" });
  }
}

export async function getSession(req, res) {
  try {
    const { code } = req.params;
    const session = await ClipboardSession.findOne({ code });
    if (!session) return res.status(404).json({ error: "NOT_FOUND" });
    // NOTE: Returning linkToken so a client joining by code can reconstruct the shared secret.
    // If you want stricter secrecy, do NOT return linkToken; instead derive secret from code only
    // or require the user to input a second factor embedded in the sharable link (#fragment not sent to server).
    return res.json({
      code: session.code,
      linkToken: session.linkToken,
      allowHistory: session.allowHistory,
      hasLatest: !!session.latest,
    });
  } catch (e) {
    return res.status(500).json({ error: "FAILED_FETCH" });
  }
}

export async function updateClipboard(req, res) {
  try {
    const { code } = req.params;
    const { ciphertext, version, replaceLatest } = req.body;
    if (typeof ciphertext !== "string")
      return res.status(400).json({ error: "INVALID_CIPHERTEXT" });
    const session = await ClipboardSession.findOne({ code });
    if (!session) return res.status(404).json({ error: "NOT_FOUND" });

    let nextVersion = version;
    const now = new Date();
    if (replaceLatest && session.latest) {
      // Modify existing latest entry only, do not create a new version
      session.latest.ciphertext = ciphertext;
      session.latest.updatedAt = now;
      if (session.allowHistory) {
        const idx = session.history.findIndex(h => h.version === session.latest.version);
        if (idx !== -1) {
          session.history[idx].ciphertext = ciphertext;
          session.history[idx].updatedAt = now;
        }
      } else {
        session.history = [session.latest];
      }
      nextVersion = session.latest.version;
    } else {
      if (nextVersion == null) {
        nextVersion = (session.latest?.version || 0) + 1;
      }
      const item = { ciphertext, version: nextVersion, createdAt: now, updatedAt: now };
      session.latest = item;
      if (session.allowHistory) {
        session.history.push(item);
      } else {
        session.history = [item];
      }
    }
    await session.save();

    return res.json({ ok: true, version: nextVersion });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "FAILED_UPDATE" });
  }
}

export async function getHistory(req, res) {
  try {
    const { code } = req.params;
    const session = await ClipboardSession.findOne({ code });
    if (!session) return res.status(404).json({ error: "NOT_FOUND" });
    return res.json({
      allowHistory: session.allowHistory,
      history: session.history.map((h) => ({
        version: h.version,
        ciphertext: h.ciphertext,
        createdAt: h.createdAt,
      })),
    });
  } catch (e) {
    return res.status(500).json({ error: "FAILED_HISTORY" });
  }
}

export async function deleteHistoryItem(req, res) {
  try {
    const { code, version } = req.params;
    const v = parseInt(version, 10);
    const session = await ClipboardSession.findOne({ code });
    if (!session) return res.status(404).json({ error: "NOT_FOUND" });
    session.history = session.history.filter((h) => h.version !== v);
    if (session.latest?.version === v) {
      session.latest = session.history[session.history.length - 1] || null;
    }
    await session.save();
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "FAILED_DELETE" });
  }
}

export async function toggleHistory(req, res) {
  try {
    const { code } = req.params;
    const session = await ClipboardSession.findOne({ code });
    if (!session) return res.status(404).json({ error: "NOT_FOUND" });
    session.allowHistory = !session.allowHistory;
    if (!session.allowHistory && session.latest) {
      session.history = [session.latest];
    }
    await session.save();
    return res.json({ allowHistory: session.allowHistory });
  } catch (e) {
    return res.status(500).json({ error: "FAILED_TOGGLE" });
  }
}

export async function restoreHistoryItems(req, res) {
  try {
    const { code } = req.params;
    const { items } = req.body; // [{version,ciphertext,createdAt}]
    if (!Array.isArray(items)) return res.status(400).json({ error: 'INVALID_ITEMS' });
    const session = await ClipboardSession.findOne({ code });
    if (!session) return res.status(404).json({ error: 'NOT_FOUND' });
    items.forEach(it => {
      if (typeof it?.version !== 'number' || typeof it?.ciphertext !== 'string') return;
      const exists = session.history.find(h => h.version === it.version);
      if (!exists) {
        session.history.push({ ciphertext: it.ciphertext, version: it.version, createdAt: it.createdAt ? new Date(it.createdAt) : new Date(), updatedAt: new Date() });
      }
    });
    // Reset latest to highest version
    session.history.sort((a,b)=>a.version - b.version);
    session.latest = session.history[session.history.length - 1] || null;
    await session.save();
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'FAILED_RESTORE' });
  }
}
