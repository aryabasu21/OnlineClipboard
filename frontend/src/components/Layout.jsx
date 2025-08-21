import React from "react";

export function Shell({ sidebar, main, right }) {
  return (
    <div className="app-shell">
      <aside className="shell-left">{sidebar}</aside>
      <main className="shell-main">{main}</main>
      <aside className="shell-right">{right}</aside>
    </div>
  );
}

export function Panel({ title, actions, children, footer, dense }) {
  return (
    <section className={"panel " + (dense ? "dense" : "")}>
      {(title || actions) && (
        <header className="panel-head">
          <h2>{title}</h2>
          {actions && <div className="panel-actions">{actions}</div>}
        </header>
      )}
      <div className="panel-body">{children}</div>
      {footer && <footer className="panel-foot">{footer}</footer>}
    </section>
  );
}
