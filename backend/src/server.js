import http from "http";
import express from "express";
import { Server } from "socket.io";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
// Mongo & REST clipboard routes removed after migration to Convex.
import { verifySocketAuth } from "./middleware/auth.js";

dotenv.config();

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") || "*" }));
app.use(express.json({ limit: "64kb" }));

const limiter = rateLimit({ windowMs: 60 * 1000, max: 120 });
app.use(limiter);

app.get("/health", (_req, res) => res.json({ status: "ok" }));
// REST API removed (data now handled directly via Convex from client). Keep health endpoint only.

// Lightweight handler for /join/:token when backend is accessed directly.
// Option 1: redirect to frontend base URL if set; else show minimal HTML instructing user to open frontend.
app.get('/join/:token', (req,res) => {
  const front = process.env.FRONTEND_BASE_URL;
  if (front) {
    return res.redirect(302, `${front.replace(/\/$/, '')}/join/${req.params.token}`);
  }
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.end(`<!doctype html><html><head><title>Join Clipboard</title><meta name="viewport" content="width=device-width,initial-scale=1"/><style>body{font-family:system-ui;background:#0b0f17;color:#e5eef9;display:flex;align-items:center;justify-content:center;height:100vh;padding:1.5rem;text-align:center}a{color:#60a5fa;text-decoration:none}</style></head><body><div><h1>Online Clipboard</h1><p>Open the frontend app and it will auto-detect token:</p><code style="background:#172230;padding:.35rem .55rem;border-radius:6px;display:inline-block;margin:.5rem 0">${req.params.token}</code><p>Or configure FRONTEND_BASE_URL to auto-redirect.</p></div></body></html>`);
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: process.env.CORS_ORIGIN?.split(",") || "*" },
});

io.use(verifySocketAuth);

io.on("connection", (socket) => {
  socket.on("join", ({ room }) => {
    socket.join(room);
  });
  socket.on("clipboard:update", ({ room, ciphertext, version }) => {
    socket.to(room).emit("clipboard:updated", { ciphertext, version });
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server listening on ${PORT} (no Mongo)`));
