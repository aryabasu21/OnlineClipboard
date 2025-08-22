# Online Clipboard Frontend

Vite vanilla JS frontend implementing:

- Create session (code, link, QR)
- E2E encryption via Web Crypto AES-GCM
- Real-time sync via Socket.IO
- History view, restore, delete

## Deployment (GitHub Pages + Custom Domain)

This project can deploy the static frontend to GitHub Pages. The workflow `deploy-gh-pages.yml` builds `frontend` and publishes `dist`.

Steps:

1. Ensure your default branch is `main` (or `master`).
2. Replace the placeholder domain in `public/CNAME` with your real custom domain (apex or subdomain). Commit.
3. In the repo settings: Pages -> Build and deployment -> Source: GitHub Actions. Save.
4. Add DNS records at your DNS provider:
   - For apex (example.com): set two A records to `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
   - For `www` or other subdomain: add CNAME to `<username>.github.io`.
5. (Optional) If using only a subdomain (e.g. `app.example.com`), a single CNAME pointing to `<username>.github.io` is enough; keep that exact value.
6. Push changes to trigger the workflow. First run will publish and attach Pages environment.
7. After DNS propagates (can take minutes to 24h), HTTPS should auto-enable. You may need to toggle "Enforce HTTPS" once the certificate is issued.

Environment variables:

- Set `VITE_API_BASE` and `VITE_SOCKET_URL` as Repository Variables or Secrets if different from origin. They map to build-time env in the workflow.

SPA routing:

- `404.html` is a copy of `index.html` (added in workflow) so client-side routes (e.g. `/join/<token>`) load correctly.

Cache busting:

- Vite outputs hashed assets; safe to enable long-lived static caching at CDN layer.

Troubleshooting:

- If the custom domain shows the default GitHub 404, verify the `CNAME` file is present in the deployed `gh-pages` branch (Pages artifact) and DNS points correctly.
- If HTTPS not available after some time, remove & re-add the custom domain in Pages settings to re-trigger certificate issuance.

Future improvements:

- Join existing session by link / code input
- Auto copy change detection and push
- Conflict resolution / version diff
- Offline queueing
