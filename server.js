// OnlineClipboard relay server
// Runs on PORT and relays "clipboard:update" to room peers as "clipboard:updated"

import http from "http";
import { Server } from "socket.io";

const PORT = Number(process.env.VITE_BACKEND_PORT || process.env.PORT || 4000);

// Lock CORS down to known frontends instead of reflecting any origin.
// "origin: true" + "credentials: true" lets ANY website's JS connect with
// credentials attached — fine for local dev, not for a public server.
// Set ALLOWED_ORIGINS as a comma-separated env var in Dokploy to override.
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS || "https://clip.stylnode.in,http://localhost:5173"
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", rooms: io.sockets.adapter.rooms.size }));
    return;
  }
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("OnlineClipboard Socket Server\n");
});

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // non-browser clients (curl, mobile)
      callback(null, allowedOrigins.includes(origin));
    },
    credentials: true,
  },
  transports: ["websocket", "polling"],
  // Reject any single message over ~256KB so a bad/abusive client can't
  // send a multi-MB "clipboard" payload and chew up memory/bandwidth.
  maxHttpBufferSize: 256 * 1024,
});

// Very small per-socket throttle: ignore updates sent faster than every
// 150ms from the same connection, so a buggy/malicious client can't flood
// a room with updates.
const MIN_UPDATE_INTERVAL_MS = 150;

io.on("connection", (socket) => {
  let room = null;
  let lastUpdateAt = 0;

  socket.on("join", ({ room: r } = {}) => {
    const next = String(r || "").trim().slice(0, 64); // bound room name length
    if (!next) return;
    if (room) socket.leave(room);
    room = next;
    socket.join(room);
  });

  socket.on("clipboard:update", ({ room: r, ciphertext, version } = {}) => {
    const now = Date.now();
    if (now - lastUpdateAt < MIN_UPDATE_INTERVAL_MS) return;
    lastUpdateAt = now;

    const target = String(r || room || "").trim();
    if (!target) return;
    if (typeof ciphertext !== "string" || ciphertext.length > 200_000) return; // sanity bound

    socket.to(target).emit("clipboard:updated", { ciphertext, version });
  });

  socket.on("disconnect", () => {
    // no-op — socket.io auto-removes the socket from its rooms
  });
});

server.listen(PORT, () => {
  console.log(`Socket server listening on http://localhost:${PORT}`);
  console.log(`Allowed origins: ${allowedOrigins.join(", ")}`);
});

// Dokploy sends SIGTERM on redeploy/stop — close connections cleanly instead
// of killing the process mid-write, so clients get a proper disconnect event
// and reconnect, rather than silently hanging.
const shutdown = () => {
  console.log("Shutting down...");
  io.close(() => {
    server.close(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 5000).unref(); // force-exit if something hangs
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
