import React, { useEffect, useRef, useState } from "react";

export function HistoryList({
  items,
  selected,
  expanded = new Set(),
  onToggleSelect,
  onToggleExpand,
  onRestore,
  onEdit,
  onDelete,
  editingVersion,
  enableHighlight = true,
  maxLines = 3,
}) {
  const [prismReady, setPrismReady] = useState(false);
  const loadingRef = useRef(false);
  useEffect(() => {
    if (!enableHighlight || prismReady || loadingRef.current) return;
    const hasCode = items.some((it) => it.lang && it.lang !== "plain");
    if (!hasCode) return;
    loadingRef.current = true;
    (async () => {
      try {
        await import("prismjs");
        const langs = [
          "javascript",
          "typescript",
          "json",
          "python",
          "java",
          "csharp",
          "cpp",
          "go",
          "rust",
          "sql",
        ];
        await Promise.all(
          langs.map((l) =>
            import(/* @vite-ignore */ `prismjs/components/prism-${l}.js`).catch(
              () => {}
            )
          )
        );
        requestAnimationFrame(() => {
          if (window.Prism?.highlightAll) window.Prism.highlightAll();
        });
        setPrismReady(true);
      } catch {}
    })();
  }, [enableHighlight, prismReady, items]);
  useEffect(() => {
    if (prismReady && window.Prism?.highlightAll) {
      const id = requestAnimationFrame(() => window.Prism.highlightAll());
      return () => cancelAnimationFrame(id);
    }
  }, [items, prismReady]);
  if (!items.length)
    return (
      <div className="hist-empty" role="status">
        No history
      </div>
    );
  return (
    <ul className="history-grid" role="list" aria-label="Clipboard history">
      {items
        .slice()
        .reverse()
        .map((item) => {
          const isSel = selected.has(item.version);
          const isEditing = editingVersion === item.version;
          const lang = (item.lang || "plain").toLowerCase();
          const isExpanded = expanded.has(item.version);
          const showExpand =
            !!item.preview &&
            (item.preview.length > 140 || item.preview.includes("\n"));
          return (
            <li
              key={item.version}
              className={
                "hist-row" +
                (isSel ? " sel" : "") +
                (isEditing ? " editing" : "") +
                (lang !== "plain" ? " code" : "") +
                (isExpanded ? " expanded" : "")
              }
              tabIndex={0}
              aria-selected={isSel}
              aria-expanded={isExpanded}
              aria-label={`History version ${item.version}${isEditing ? " (editing)" : ""}`}
              onKeyDown={(e) => {
                if (e.key === " ") {
                  e.preventDefault();
                  onToggleSelect(item.version);
                } else if (e.key === "Enter") {
                  onRestore(item);
                }
              }}
              onClick={(e) => {
                const t = e.target;
                if (t?.closest) {
                  if (
                    t.closest(".hist-actions") ||
                    t.closest(".expand-btn") ||
                    t.closest('input[type="checkbox"]')
                  )
                    return;
                }
                onRestore(item);
              }}
            >
              <div className="hist-main" style={{ "--lines": maxLines }}>
                <input
                  aria-label={isSel ? "Deselect version" : "Select version"}
                  type="checkbox"
                  checked={isSel}
                  onChange={() => onToggleSelect(item.version)}
                />
                <pre
                  className="hist-preview"
                  aria-describedby={`meta-${item.version}`}
                >
                  <code className={`language-${lang}`}>
                    {item.preview || "..."}
                  </code>
                  {showExpand && !isExpanded && (
                    <div className="fade-edge" aria-hidden="true" />
                  )}
                </pre>
                {showExpand && (
                  <button
                    type="button"
                    className="expand-btn"
                    onClick={() => onToggleExpand?.(item)}
                    aria-expanded={isExpanded}
                    aria-label={
                      isExpanded ? "Collapse preview" : "Expand to full"
                    }
                  >
                    {isExpanded ? "Collapse" : "Expand"}
                  </button>
                )}
                <div id={`meta-${item.version}`} className="hist-meta">
                  <span className="chip chip-lang" title={lang}>
                    {lang}
                  </span>
                  <span className="chip chip-ver">v{item.version}</span>
                  {isEditing && <span className="chip chip-edit">Editing</span>}
                </div>
              </div>
              <div
                className="hist-actions"
                aria-label={`Actions for version ${item.version}`}
              >
                <button
                  className="mini"
                  onClick={() => onRestore(item)}
                  title="Restore this version"
                >
                  Restore
                </button>
                <button
                  className="mini"
                  disabled={editingVersion != null && !isEditing}
                  onClick={() => onEdit(item)}
                  title={
                    isEditing
                      ? "Finish editing in main panel"
                      : "Edit this version"
                  }
                >
                  {isEditing ? "…" : "Edit"}
                </button>
                <button
                  className="mini danger"
                  onClick={() => onDelete(item)}
                  title="Delete this version"
                >
                  Del
                </button>
              </div>
            </li>
          );
        })}
    </ul>
  );
}
