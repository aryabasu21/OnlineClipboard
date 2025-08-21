import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./app.css";

// Simple Error Boundary
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(err, info) {
    console.error("App error boundary caught", err, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: "1.5rem", fontFamily: "system-ui" }}>
          <h1>Something broke</h1>
          <p style={{ opacity: 0.75 }}>An unexpected error occurred.</p>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              fontSize: ".65rem",
              background: "#111",
              padding: ".75rem",
              borderRadius: 6,
            }}
          >
            {String(this.state.error)}
          </pre>
          <button onClick={() => location.reload()}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Accept both VITE_CONVEX_URL (preferred) and fallback to raw CONVEX_URL if manually injected.
const convexUrl =
  import.meta.env.VITE_CONVEX_URL ||
  import.meta.env.CONVEX_URL ||
  window.CONVEX_URL;

const rootEl = document.getElementById("app");

if (!convexUrl) {
  console.error(
    "Convex URL not configured. Set VITE_CONVEX_URL in frontend/.env.local."
  );
  createRoot(rootEl).render(
    <div
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: "2rem",
        lineHeight: 1.5,
      }}
    >
      <h1 style={{ marginTop: 0 }}>Configuration Needed</h1>
      <p>
        No Convex endpoint found. Create a file <code>frontend/.env.local</code>{" "}
        with:
      </p>
      <pre
        style={{
          background: "#111",
          padding: "0.75rem 1rem",
          borderRadius: "8px",
          overflow: "auto",
        }}
      >{`VITE_CONVEX_URL=https://YOUR-DEPLOYMENT.convex.cloud`}</pre>
      <p>
        Then restart <code>npm run dev</code>.
      </p>
    </div>
  );
} else {
  (async () => {
    try {
      const mod = await import("convex/browser");
      const ConvexClient = mod.ConvexClient || mod.default || mod;
      const convexClient = new ConvexClient(convexUrl);
      window.__convexClient = {
        mutation: (name, args) => convexClient.mutation(name, args),
        query: (name, args) => convexClient.query(name, args),
      };
      createRoot(rootEl).render(
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      );
    } catch (e) {
      console.error("Failed to initialize convex/browser client", e);
      createRoot(rootEl).render(
        <div style={{ padding: "1.5rem", fontFamily: "system-ui" }}>
          <h1>Convex Client Error</h1>
          <p>
            Could not load Convex browser client. Try reinstalling dependencies.
          </p>
          <pre
            style={{
              background: "#111",
              padding: "0.75rem 1rem",
              borderRadius: 6,
              fontSize: "0.75rem",
              overflow: "auto",
            }}
          >
            {String(e)}
          </pre>
        </div>
      );
    }
  })();
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
