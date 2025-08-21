## Online Clipboard (Convex + React)

Dev setup:

1. Install root deps (workspace): `npm install` (adds convex dev dep).
2. Run Convex dev (separate shell) or use provided script: `npx convex dev` in project root (or `npm run dev:convex`).
3. Copy the Convex deployment URL output and set it in `frontend/.env`:

```
VITE_CONVEX_URL=https://YOUR-DEPLOYMENT.convex.cloud
```

4. Start frontend dev server: `cd frontend && npm run dev`.

If TypeScript can't resolve `convex/values`, ensure the `convex` package is installed where TypeScript is running and that the `convex` folder is included in `tsconfig.json`.

The backend Express server is now only a Socket.IO relay and health endpoint; persistence lives in Convex functions under `convex/`.

# Online Clipboard (MERN E2E Encrypted)

Monorepo containing backend (Express/Mongo) and frontend (Vite) for a secure online clipboard with:

- End-to-end encryption (client AES-GCM) – server stores ciphertext only
- Share methods: 5-char alphanumeric code, sharable link (token), QR code (encoded link)
- Real-time updates using Socket.IO
- History (enable/disable) with per-version deletion & restore
- Session auto-expiry (24h TTL default)
- Multi-select history delete & undo last delete
- Auto / manual rejoin of last session after refresh or disconnect

## Architecture

- Backend: stateless session logic; no plaintext. Each session has short code + link token.
- Client derives secret key from (code + token) -> PBKDF2 -> AES-GCM.
- Updates broadcast over websocket (ciphertext only).

## Running Locally

1. Backend
   cd backend
   npm install
   npm run dev
2. Frontend
   cd ../frontend
   npm install
   npm run dev
3. Open http://localhost:5173

Adjust CORS_ORIGIN in backend .env if needed.

## Security Notes

- Upgrade to using per-session random 32-byte secret shown once to user (instead of code+token derivation) for stronger secrecy.
- Add HMAC auth for socket room join to mitigate sniffing.
- Consider Argon2id if using a library for stronger KDF.
- Currently anonymous; add auth if persistent multi-day history needed.

## Implemented Enhancements

- Join-by-code and join-by-link with auto-detect /join/:token path
- Debounced autosave with replace-latest collapsing (single evolving version) to avoid version spam
- Multi-select delete & undo restore using temporary client cache + server restore route
- Automatic rejoin of last session via localStorage persisted session metadata

## Potential Future Improvements

- Batch delete API endpoint (single request) instead of sequential deletes
- PWA + offline draft buffering
- File / image attachment support (size capped, encrypted)
- Replace PBKDF2 with Argon2id or scrypt and add per-session salt row
- HMAC-signed websocket join token to harden real-time channel access
- UI toast system & accessibility audit
- Full migration from Mongo/Mongoose to Convex (schema & functions scaffold in /convex)
- Progressive Web App (PWA) support (service worker + manifest) – planned
