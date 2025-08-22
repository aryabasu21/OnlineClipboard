import react from "@vitejs/plugin-react";

export default {
  plugins: [react()],
  server: { host: true, port: 5173 },
  resolve: {
    alias: {
      "convex/react": "convex/dist/esm/react/index.js",
    },
  },
  build: {
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("monaco-editor/esm/vs/editor/editor.worker"))
              return "monaco-worker-core";
            if (id.includes("monaco-editor/esm/vs/language"))
              return "monaco-workers";
            if (id.includes("monaco-editor")) return "monaco";
            if (id.includes("prettier")) return "prettier";
            if (id.includes("prismjs")) return "prism";
            if (id.includes("socket.io")) return "socket";
            if (id.includes("convex")) return "convex";
            if (id.includes("react")) return "react-vendor";
            return "vendor";
          }
        },
      },
    },
  },
};
