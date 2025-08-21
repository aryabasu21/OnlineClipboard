# Online Clipboard Backend

MVP backend for secure E2E encrypted multi-device clipboard.

## Features

- Create share session -> code (5-char), link, generate QR client-side from link
- Update clipboard (ciphertext only, server never sees plaintext)
- Optional history toggle; delete individual versions
- Real-time updates via WebSocket (Socket.IO)
- Sessions auto-expire (TTL 24h, configurable)
- Rate limiting, CORS, Helmet

## Data Model

ClipboardSession: { code, linkToken, latest{ciphertext,version}, history[], expiresAt, allowHistory }

## E2E Encryption (Client Responsibility)

- Derive symmetric key from: code + linkToken (or randomly generated secret) using PBKDF2/Argon2 in client
- Encrypt clipboard text with AES-GCM -> ciphertext (base64 + iv + tag) send to server
- Server stores ciphertext only.
- Real-time events broadcast ciphertext.

## Future Hardening

- Signature for socket join (HMAC of room id with key) to prevent unauthorized listeners
- Optional user accounts & persistent history beyond session TTL
- Zero-knowledge deletion confirm

## Env

PORT=4000
MONGO_URI=mongodb://127.0.0.1:27017/online_clipboard
CORS_ORIGIN=http://localhost:5173

### Using MongoDB Atlas
1. Whitelist your IP (or 0.0.0.0/0 for dev only) in Atlas Network Access.
2. Create a database user with a strong password (avoid special chars that need URL encoding or encode them).
3. Copy your SRV URI from Atlas (looks like):
	`mongodb+srv://<USER>:<PASSWORD>@cluster0.xxxxx.mongodb.net/<DB>?retryWrites=true&w=majority&appName=Cluster0`
4. Put it in your `.env` (never commit real credentials):
	`MONGO_URI=mongodb+srv://clipboard_user:SuperSecret123@cluster0.xxxxx.mongodb.net/online_clipboard?retryWrites=true&w=majority&appName=Cluster0`
5. If you omit `<DB>` after the host, specify it in code with connection options or include it (recommended).
6. Ensure SRV DNS works on your network (some corporate DNS blocks `_srv`).

Troubleshooting Atlas connection:
- ECONNREFUSED: Usually local Mongo attempt, confirm your `MONGO_URI` exported.
- ETIMEDOUT / getaddrinfo ENOTFOUND: DNS or firewall; test with `nslookup _mongodb._tcp.cluster0.xxxxx.mongodb.net`.
- Authentication failed: Re-check URL encoding (e.g., `@`, `:` must be encoded or avoid in password).

### Mobile / LAN Testing
Set an explicit base URL so generated share links are reachable from phones on the same Wi‑Fi:

Add to `.env`:
```
PUBLIC_BASE_URL=http://192.168.1.42:4000
```
Replace `192.168.1.42` with your machine's LAN IP (find via `ipconfig` on Windows). Ensure firewall allows inbound on port 4000.

## Run

npm install
npm run dev
