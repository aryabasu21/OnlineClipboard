// Simple Socket.IO dev server for realtime clipboard updates
// Runs on PORT (defaults to 4000) and relays "clipboard:update" to room peers as "clipboard:updated"

import http from "http";
import { Server } from "socket.io";

const PORT = Number(process.env.VITE_BACKEND_PORT || process.env.PORT || 4000);

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("OnlineClipboard Socket Server\n");
});

const io = new Server(server, {
  cors: {
    origin: true, // allow Vite dev origin
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

io.on("connection", (socket) => {
  let room = null;
  socket.on("join", ({ room: r }) => {
    if (room) socket.leave(room);
    room = String(r || "").trim();
    if (room) socket.join(room);
  });

  socket.on("clipboard:update", ({ room: r, ciphertext, version }) => {
    const target = String(r || room || "").trim();
    if (!target) return;
    socket.to(target).emit("clipboard:updated", { ciphertext, version });
  });

  socket.on("disconnect", () => {
    // no-op
  });
});

server.listen(PORT, () => {
  console.log(`Socket server listening on http://localhost:${PORT}`);
});
