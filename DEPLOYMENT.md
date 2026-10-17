# Vercel + Render + Neon

Production uses your Vercel website, a Render Node/WebSocket service, and Neon PostgreSQL. No local Docker, PostgreSQL container, or paid video SDK is needed. The Dockerfile is built on Render, after GitHub checks pass. No local container is started by installation, migrations, development, testing, or deployment commands.

## Ready-to-copy environment files

- `.env`: current local development settings; your database credential is preserved.
- `.env.vercel.local`: public production URLs to copy/import into Vercel.
- `.env.render.local`: private Render values, including your existing database connection and relay secret. Copy/import it only into Render's Environment settings.
- `.env.vercel.example` and `.env.render.example`: commit-safe templates with credentials left blank.

The two `.local` hosting exports are ignored by Git and excluded from Docker build context. They are snapshots: refresh their secret values if you rotate credentials in `.env`. Changing these files does not update hosting dashboards automatically. Do not rename/copy the Render file to a Next.js auto-loaded `.env.local` on a Vercel-only project; its server secrets are not needed there. `PORT` comes from Render and Docker supplies its internal runtime flags. `STUN_URLS` uses Google’s public `stun:stun.l.google.com:19302` endpoint, verified with a binding request. `TURN_URLS` stays empty by your choice; no relay is enabled.

## 1. Vercel — excalidraw-steel-eta.vercel.app

Set these in Project Settings → Environment Variables for Production, then redeploy:

```dotenv
NEXT_PUBLIC_APP_URL=https://excalidraw-steel-eta.vercel.app
NEXT_PUBLIC_COLLAB_URL=wss://excalidraw-tl7h.onrender.com/collaboration
```

Install: `bun install --frozen-lockfile`. Build: `bun run build`.

This frontend does not need `DATABASE_URL`, a database password or `TURN_SHARED_SECRET`. `/api/rooms` forwards creation to Render, which saves the initial board in Neon before returning the invite. The classroom derives `/classroom/ROOM_ID` on the Render host. This repository uses its custom Node WebSocket hub on Render; adopting Vercel's WebSocket APIs would require a different hub adapter and shared live-state architecture.

`NEXT_PUBLIC_*` settings are embedded at build time. Production and preview deployments have separate environment scopes. If students use a preview domain, add its exact origin to Render's allowlist or use a separate preview hub.

## 2. Render — excalidraw-tl7h.onrender.com

Connect the repository/service to [render.yaml](render.yaml), or apply the same settings to your existing service. Docker builds run on Render, not your computer. The Dockerfile declares only the two public URL build arguments so the browser bundle receives the correct domain; database and relay secrets remain runtime-only. The Blueprint uses the free compute plan with no persistent disk and waits for CI checks to pass before auto-deploying. If updating an existing service, verify its plan, disk and auto-deploy setting in the dashboard; editing the local YAML alone does not change an existing unlinked service.

Set these non-secret values in Render → Environment:

```dotenv
NEXT_PUBLIC_APP_URL=https://excalidraw-steel-eta.vercel.app
NEXT_PUBLIC_COLLAB_URL=wss://excalidraw-tl7h.onrender.com/collaboration
WEB_HOST=0.0.0.0
COLLAB_DATA_DIR=/tmp/knotleaf-rooms
COLLAB_ORIGINS=https://excalidraw-steel-eta.vercel.app,https://excalidraw-tl7h.onrender.com
CLASSROOM_MAX_PARTICIPANTS=8
```

Add the following **secret** environment value:

```dotenv
DATABASE_URL=YOUR_COMPLETE_POOLED_NEON_CONNECTION_STRING
```

Copy your actual `DATABASE_URL` from the ignored local `.env` into Render's secret environment field. Its password is already included in the connection string; **no separate `POSTGRES_PASSWORD` setting is used**. Keep TLS/certificate verification enabled. Never expose this as `NEXT_PUBLIC_*`, commit it, or place it in GitHub workflow YAML. `sync: false` in the Blueprint reserves the secret field without publishing its value.

Render provides `PORT`; leave it unset. Docker runtime starts `node server/web.mjs`. If using Render's native Node runtime instead, install/build with `bun install --frozen-lockfile && bun run build`, start `bun start`, and use Node 24. Health check: `/api/collaboration-health`.

Free Render services can sleep. Sleeping/restarting interrupts live sessions, even though Neon preserves confirmed saves. No paid disk is required: `/tmp/knotleaf-rooms` contains only ephemeral recovery copies. Back up existing `.bin` room files and open/export important old rooms before detaching any old persistent disk; old rooms that never reached Neon need their recovery files to migrate. Run one hub replica: PostgreSQL stores snapshots, but does not distribute live Yjs or signaling events between independent hubs.

## 3. Neon data and migrations

Use the pooled connection string from your Neon project. The existing generic `pg` driver supports Neon; a Neon-specific SDK is not installed. The configured `.env` connection is preserved when changing public URL settings.

```sh
bun run db:migrate
bun run db:check
```

These connect directly to Neon; neither command starts Docker or PostgreSQL locally. Migration creates `knotleaf_rooms` with room UUID, title, public invite URL/path, full Yjs state, a JSON snapshot of shapes/code/notes, and timestamps. The check verifies the schema and performs temporary reads/writes/updates in a rolled-back transaction. The room server also initializes the idempotent schema on first use after deployment.

Shared canvas, code and Markdown content is stored in Neon. Personal workspaces/history/templates remain browser-local because there is no authenticated account identity for private cloud storage. Presence, chat and call negotiation are ephemeral. Recordings download to your computer and are not uploaded to Neon.

The server loads saved state before synchronization, rejects unavailable storage instead of opening an empty board, and merges recovery files using Yjs. A minimum two-second address-selection attempt timeout avoids premature TCP failures on remote database endpoints. Keep regular editable `.knotleaf` backups; deployments are not backups.

## 4. CI and updates

GitHub Actions runs typecheck, lint, regression tests, build and an actual website/room/signaling smoke test. There are no Docker or PostgreSQL services in the workflow. PostgreSQL integration tests remain available when you explicitly provide a separate `TEST_DATABASE_URL`; the standard suite skips them, while `bun run db:check` verifies your configured Neon database directly.

Render's `autoDeployTrigger: checksPass` builds/deploys the linked branch after CI succeeds. For an existing service not managed by this Blueprint, select **Auto-Deploy → After CI Checks Pass** in Render. Vercel deploys through its Git integration. Push updated code to the linked deployment branch to update the websites. Production database credentials belong only in Render's environment, not in CI; runtime schema initialization handles the current additive migration. No repository push, remote dashboard change or deployment has been performed by this local configuration edit.

## 5. WebRTC relay settings

Neon is a database; it cannot run camera calls, WebSocket signaling, STUN or TURN. Signaling runs on Render. Browser WebRTC carries media directly or through an optional separately hosted TURN relay. The app has no paid relay fallback.

Optional Render environment values:

```dotenv
STUN_URLS=stun:stun.l.google.com:19302
TURN_URLS=turn:YOUR_REAL_RELAY_HOST:3478?transport=udp,turn:YOUR_REAL_RELAY_HOST:3478?transport=tcp
TURN_SHARED_SECRET=YOUR_RELAY_SHARED_SECRET
```

Do not substitute `excalidraw-steel-eta.vercel.app` or the Render web-service hostname into these fields unless an actual TURN service is reachable there. An HTTPS website is not a TURN endpoint. Vercel/ordinary Render web services do not expose the UDP relay ports needed for a normal coturn deployment. Running a container in CI does not make its relay ports reachable by students; CI jobs are temporary. A relay requires a reachable persistent host with suitable ports, or a compatible hosted relay offering. No relay host was provisioned here.

The ignored local `.env` contains a randomly generated `TURN_SHARED_SECRET` when previously empty. Copy it to Render **and to your relay's matching authentication-secret setting** if you provision a relay. This is not a database password. The shared secret stays server-only; browsers receive HMAC credentials valid for 12 hours. Public STUN is enabled and its binding response was verified from this environment. Keep `TURN_URLS` empty until a working relay is configured. Some NAT/firewall combinations will fail without TURN; STUN is not a replacement for it. Google documents this STUN endpoint at https://web.dev/articles/webrtc-infrastructure. The documented Open Relay static-auth endpoint timed out over UDP/TCP/TLS during checks here, so it was not enabled. This does not prove that endpoint is globally unavailable.

Calls use a small-group mesh, default 8 participants and a maximum of 12. Setting `CLASSROOM_MAX_PARTICIPANTS=100` does not create a 100-person conferencing server; values above 12 are clamped. Larger classes need an SFU architecture. No gRPC service is required for the current browser media/signaling protocol.

## 6. Run without local Docker

Your local `.env` points to the hosted websites and Neon. Preserve `DATABASE_URL`; do not overwrite your working `.env` with the empty example. To run the frontend locally:

```sh
bun install --frozen-lockfile
bun run db:check
bun dev
```

Open `http://localhost:3000`. With the hosted room URL, local sharing calls Render; add `http://localhost:3000,http://127.0.0.1:3000` to Render's `COLLAB_ORIGINS` if you need it. These development origins are already in the local `.env`, not the production Blueprint allowlist. To test the local Node hub against Neon, temporarily leave `NEXT_PUBLIC_COLLAB_URL` and `NEXT_PUBLIC_APP_URL` empty and restart. No local database process is necessary.

## 7. Classroom and recording verification

Create/open a shared room → Classroom → name → Join class. Mic/camera start off. Screen sharing has its own track, so it can coexist with the camera. Minimize to keep drawing and editing; Leave call releases devices without leaving the board. Disconnection exposes Rejoin. Chat is temporary. Invite links grant editing and call access to anyone possessing the link; display names are not authenticated teacher/student accounts.

For local recording, select this app's tab, enable tab audio to capture remote voices, and optionally include your microphone. Stop & save downloads WebM (or MP4 if supported). Nothing uploads to the database. Recordings are held in memory and stop/save at 512 MB; split long lessons and save before closing the page. Screen/audio support varies by browser/OS; tell students before recording.

After deployment, test on two devices on different networks: edit canvas/code/notes, join, enable mic/camera, share a screen, minimize, record/save and leave. HTTPS is required outside localhost. If signaling connects but media fails, check the real relay settings and network/firewall. Unit tests and the server smoke test do not prove real-device media/NAT connectivity.
