# Convex Migration (Work in Progress)

This directory contains an initial Convex schema and server functions to replace the Mongo-backed Express REST endpoints.

## Schema Overview

- sessions table holds lightweight session metadata (code, linkToken, allowHistory, expiry, latest ciphertext)
- history table stores each version row (sessionCode + version index)

## Functions

- createSession (mutation)
- getSession (query)
- joinByToken (query)
- updateClipboard (mutation) with replaceLatest logic
- getHistory (query)
- deleteHistory (mutation)
- restoreHistoryItems (mutation)
- toggleHistory (mutation)

## Next Steps to Complete Migration

1. Install Convex & nanoid in root or separate package:
   npm install convex nanoid
   npx convex dev
2. Generate client types (Convex CLI will create convex/_generated/ files)
3. Replace frontend REST calls with Convex client calls (use createClient from convex/react or convex/browser)
4. Remove Mongoose + Express routes gradually (or keep Express only for socket + static) – or migrate realtime to Convex actions.
5. Implement TTL cleanup (cron or scheduled function) to delete expired sessions (expiresAt).

## Frontend Integration Sketch

import { ConvexProvider, ConvexReactClient } from 'convex/react';
const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);
createSession: await convex.mutation('createSession', {});

## NOTE

This is a scaffold only; additional auth / validation & rate limiting should be added as needed.
