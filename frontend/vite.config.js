import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173 },
  resolve: {
    alias: {
      "convex/react": "convex/dist/esm/react/index.js",
    },
  },
  build: {
    // Adjust if you still want warnings, but default 500k was noisy due to Monaco/Prettier.
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('monaco-editor')) return 'monaco';
            if (id.includes('prettier')) return 'prettier';
            if (id.includes('prismjs')) return 'prism';
            if (id.includes('socket.io')) return 'socket';
            if (id.includes('convex')) return 'convex';
            if (id.includes('react')) return 'react-vendor';
            // Everything else
            return 'vendor';
          }
        },
      },
    },
  },
});
