## Frontend Troubleshooting

### Dynamic Prism Import Warning

We load Prism languages dynamically. Vite can't statically analyze the template literal, so we add `/* @vite-ignore */` to suppress the warning. This is intentional and safe because the language value is constrained to a curated list.

### ENOENT convex/react index.js

If you see an error like:

```
ENOENT: no such file or directory, open '.../node_modules/convex/dist/esm/react/index.js'
```

Try:

1. Delete `node_modules` and reinstall: `npm ci` (or `npm install` if no lockfile).
2. Ensure the `convex` package version in `package.json` matches your deployed Convex version.
3. Clear Vite cache: delete `node_modules/.vite`.
4. If still failing, remove any duplicate generated folders and re-run `npx convex dev` at the repo root to regenerate `_generated` code.

### Convex URL Missing

Set `VITE_CONVEX_URL` in `frontend/.env.local` (see `main.jsx` for guidance).

### Service Worker Not Updating

Browsers aggressively cache service workers. After changes, call:

```
navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r=>r.unregister()))
```

in DevTools, then hard reload.
