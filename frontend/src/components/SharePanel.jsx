import React, { useState } from "react";

export function SharePanel({
  code,
  link,
  qrDataUrl,
  copyState,
  copy,
  onLeave,
  onForget,
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className={"share-wrapper" + (collapsed ? " collapsed" : "")}>
      <div className="share-head-mobile">
        <strong>Share</strong>
        <button
          type="button"
          className="mini secondary"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
        >
          {collapsed ? "Show" : "Hide"}
        </button>
      </div>
      {!collapsed && (
        <>
      <div className="share-grid">
        <div className="field">
          <label>Session Code</label>
          <div className="inline-field">
            <input value={code} readOnly onClick={() => copy(code, "code")} />
            <button onClick={() => copy(code, "code")} className="mini">
              {copyState.code ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
        <div className="field">
          <label>Sharable Link</label>
          <div className="inline-field">
            <input value={link} readOnly onClick={() => copy(link, "link")} />
            <button onClick={() => copy(link, "link")} className="mini">
              {copyState.link ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      </div>
  <div className="qr-flex">
        {qrDataUrl ? (
          <img src={qrDataUrl} alt="QR Code" className="qr" />
        ) : (
          <div className="qr placeholder">QR</div>
        )}
        <div className="qr-text">
          <p>
            Scan this code or use the session code above on any device.
            Everything stays end‑to‑end encrypted.
          </p>
          <p className="hint">
            Tip: First click copies. Long press on mobile to copy.
          </p>
          <div className="share-actions">
            <button className="secondary mini" onClick={onLeave}>
              Leave
            </button>
            <button className="secondary mini" onClick={onForget}>
              Leave & Forget
            </button>
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
}
