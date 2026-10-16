# Production environment settings

The current Render service answers `/api/collaboration-health` with `collaboration: true`. Vercel answers `false` until its client is rebuilt with the room endpoint configured.

## Vercel: excalidraw-steel-eta.vercel.app

In Project Settings → Environment Variables, add these values for Production (and Preview if you want preview builds to use the same server):

```dotenv
NEXT_PUBLIC_COLLAB_URL=wss://excalidraw-tl7h.onrender.com/collaboration
NEXT_PUBLIC_APP_URL=https://excalidraw-steel-eta.vercel.app
```

Redeploy after adding them. `NEXT_PUBLIC_*` values are embedded at build time. Build: `bun run build`; install: `bun install --frozen-lockfile`. No `PORT`, room data directory, secret key, or database URL is required on Vercel.

Preview origins change per deployment. With a production origin allowlist, previews require their own exact origin in Render's `COLLAB_ORIGINS`, or a separate preview room service. Do not use wildcard origins for a private deployment.

## Render: excalidraw-tl7h.onrender.com

Build: `bun install --frozen-lockfile && bun run build`.
Start: `bun start`.
Health check: `/api/collaboration-health`.

Set:

```dotenv
NEXT_PUBLIC_COLLAB_URL=wss://excalidraw-tl7h.onrender.com/collaboration
NEXT_PUBLIC_APP_URL=https://excalidraw-steel-eta.vercel.app
WEB_HOST=0.0.0.0
COLLAB_ORIGINS=https://excalidraw-steel-eta.vercel.app,https://excalidraw-tl7h.onrender.com,http://localhost:3000,http://127.0.0.1:3000
COLLAB_DATA_DIR=.collab-data
```

Render assigns `PORT` automatically: leave it unset. Do not set `COLLAB_HOST` or `COLLAB_PORT` for normal integrated startup. `WEB_HOST=0.0.0.0` makes the app reachable through Render's proxy. The first two origins allow the hosted sites; the last two allow local development. Remove development origins if you do not need those clients. A custom domain must also be added exactly, including its `https://` scheme.

Without a persistent disk, `.collab-data` is ephemeral across deploys/restarts and room history can disappear. If you attach a Render persistent disk at `/data/rooms`, change `COLLAB_DATA_DIR` to `/data/rooms`. Render's free services may cold-start or sleep, causing reconnect delays; persistent always-on hosting is preferable for regular collaboration.

Redeploy Render when changing client-public variables. Server-only changes also require the service to restart. Keep the web URL and WebSocket endpoint pointing at the same room service for all participants.

## Local checkout

The ignored `.env` in this checkout contains the production URLs above and local server settings. This means local builds use the hosted room service. To use only a local room server, set `NEXT_PUBLIC_COLLAB_URL=` and `NEXT_PUBLIC_APP_URL=` and restart/rebuild.

The optional `NEXT_PUBLIC_APP_URL` ensures invite links use the public Vercel frontend. It is a public URL, not a secret. No authentication secrets are needed for the current UUID invite model; anyone with a room link can edit it.

## Verify sharing

1. Both sites must have the updated code and environment settings.
2. Vercel's `/api/collaboration-health` should report `collaboration: true` after its rebuild.
3. Open Share, create a room, and wait for Connected.
4. Copy the invite and open it on another device/browser. Add a shape and a note in each window; both should update.
5. Confirm the second browser's exact origin appears in `COLLAB_ORIGINS` if the WebSocket connection is denied.

The current code uses Next.js 16.4.2 and React 19.3.1. Commit both package.json and bun.lock; do not deploy the previous Next.js 16.0.1 lockfile.
