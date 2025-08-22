## Online Clipboard (Convex + React)

Single-root project (flattened from previous frontend/backend structure on 2025-08-22). Source lives in `src/` and Convex functions in `convex/`.

### Dev Setup

1. Install deps:
   ```bash
   npm install
   ```
2. Start concurrent Convex dev + Vite dev:
   ```bash
   npm run dev
   ```
3. Provide Convex URL via `.env.local` in project root:
   ```
   VITE_CONVEX_URL=https://YOUR-DEPLOYMENT.convex.cloud
   ```
4. Open http://localhost:5173

### Build

```bash
npm run build
```

Outputs static site in `dist/` for GitHub Pages (workflow provided) including `CNAME`.

### Scripts

| Script  | Purpose                             |
| ------- | ----------------------------------- |
| dev     | Runs Convex dev + Vite dev together |
| convex  | Only Convex dev server              |
| build   | Production build                    |
| preview | Preview built dist                  |
| clean   | Remove node_modules/.vite           |

### Environment

`VITE_CONVEX_URL` required at build & runtime for browser client.

### Notes

Legacy Express/Mongo backend & old `frontend/` folder have been removed (flatten complete). Real-time updates currently rely on a lightweight Socket.IO relay (client initiated) alongside Convex for persistence. This can be eliminated later if Convex real-time queries fully replace the relay.

# Feature Summary

Secure online clipboard with:

- End-to-end encryption (client AES-GCM) – server stores ciphertext only
- Share methods: 5-char alphanumeric code, sharable link (token), QR code (encoded link)
- Real-time updates using Socket.IO
- History (enable/disable) with per-version deletion & restore
- Session auto-expiry (24h TTL default)
- Multi-select history delete & undo last delete
- Auto / manual rejoin of last session after refresh or disconnect

## Architecture Overview

- Client derives secret key from (code + token) -> PBKDF2 -> AES-GCM (ciphertext only leaves browser)
- Convex functions store and query encrypted versions & session metadata
- Socket.IO relay broadcasts ciphertext updates to peers in the same session room

## Running Locally

1. Create `.env.local` with Convex URL (see above)
2. `npm run dev`
3. Open http://localhost:5173

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

- Batch delete API endpoint (single request) instead of sequential deletes (client already batches; server side future)
- PWA + offline draft buffering
- File / image attachment support (size capped, encrypted)
- Replace PBKDF2 with Argon2id or scrypt and add per-session salt row
- HMAC-signed websocket join token to harden real-time channel access
- Accessibility audit & keyboard shortcuts expansion
- Remove Socket.IO relay once Convex real-time fully suffices
- Progressive Web App (PWA) support (service worker + manifest)

---

### Changelog

- 2025-08-22: Flattened repository (removed legacy `frontend/` & `backend/`).
