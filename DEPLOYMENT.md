# Vercel + Render + Neon

Production uses your Vercel website, a Render Node/WebSocket service, and Neon PostgreSQL. No local Docker, PostgreSQL container, or paid video SDK is needed. The Dockerfile is built on Render, after GitHub checks pass. No local container is started by installation, migrations, development, testing, or deployment commands.

## Ready-to-copy environment files

- `.env`: current local development settings; your database credential is preserved.
- `.env.vercel.local`: a hosting export; refresh it with the account settings below before importing into Vercel.
- `.env.render.local`: private Render values, including your existing database connection and relay secret. Copy/import it only into Render's Environment settings.
- `.env.vercel.example` and `.env.render.example`: commit-safe templates with credentials left blank.

The two `.local` hosting exports are ignored by Git and excluded from Docker build context. They are snapshots: refresh their secret values if you rotate credentials in `.env`. Changing these files does not update hosting dashboards automatically. Do not copy the entire Render export into the frontend. Vercel needs the account database and OAuth settings below; room relay secrets remain on Render. `PORT` comes from Render and Docker supplies its internal runtime flags. `STUN_URLS` uses Google’s public `stun:stun.l.google.com:19302` endpoint, verified with a binding request. `TURN_URLS` stays empty by your choice; no relay is enabled.

## 1. Vercel — knotleaf-desk.vercel.app

Set these in Project Settings → Environment Variables for Production, then redeploy:

```dotenv
NEXT_PUBLIC_APP_URL=https://knotleaf-desk.vercel.app
NEXT_PUBLIC_COLLAB_URL=wss://excalidraw-tl7h.onrender.com/collaboration
BETTER_AUTH_URL=https://knotleaf-desk.vercel.app
BETTER_AUTH_SECRET=YOUR_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
DATABASE_URL=YOUR_COMPLETE_POOLED_NEON_CONNECTION_STRING
GOOGLE_CLIENT_ID=YOUR_GOOGLE_WEB_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_WEB_CLIENT_SECRET
```

Install: `bun install --frozen-lockfile`. Build: `bun run build:vercel` (validates account settings and migrates its schema before building).

Account sign-in runs on the Next.js frontend and requires its own server-side access to `DATABASE_URL`, `BETTER_AUTH_SECRET`, and the Google credentials. Set these in the Vercel **Production** environment, even if the database is already configured on Render. Local `.env` edits do not update Vercel. Run `bun run auth:migrate` with the production database settings, register `https://knotleaf-desk.vercel.app/api/auth/callback/google` in the matching Google Web client, and redeploy. `TURN_SHARED_SECRET` stays on Render. `/api/rooms` saves the initial board directly in Neon when the frontend has the same room `DATABASE_URL` as Render. It returns the invite after the save and wakes Render independently; without that database setting it retains the proxy path through Render. The classroom derives `/classroom/ROOM_ID` on the Render host. This repository uses its custom Node WebSocket hub on Render; adopting Vercel's WebSocket APIs would require a different hub adapter and shared live-state architecture.

Room clients obtain their WebSocket endpoint at runtime from `/api/collaboration-health`. The proxy fallback permits up to 55 seconds for room-host startup, within its 60-second function duration; a room is returned only after storage succeeds. Other `NEXT_PUBLIC_*` settings may be embedded at build time. Production and preview deployments have separate environment scopes. If students use a preview domain, add its exact origin to Render's allowlist or use a separate preview hub.

## 2. Render — excalidraw-tl7h.onrender.com

Connect the repository/service to [render.yaml](render.yaml), or apply the same settings to your existing service. Docker builds run on Render, not your computer. The Dockerfile declares only the two public URL build arguments so the browser bundle receives the correct domain; database and relay secrets remain runtime-only. The Blueprint uses the free compute plan with no persistent disk and waits for CI checks to pass before auto-deploying. If updating an existing service, verify its plan, disk and auto-deploy setting in the dashboard; editing the local YAML alone does not change an existing unlinked service.

Set these non-secret values in Render → Environment:

```dotenv
NEXT_PUBLIC_APP_URL=https://knotleaf-desk.vercel.app
NEXT_PUBLIC_COLLAB_URL=wss://excalidraw-tl7h.onrender.com/collaboration
WEB_HOST=0.0.0.0
COLLAB_DATA_DIR=/tmp/knotleaf-rooms
COLLAB_ORIGINS=https://knotleaf-desk.vercel.app,https://excalidraw-tl7h.onrender.com
CLASSROOM_MAX_PARTICIPANTS=8
```

Add the following **secret** environment value:

```dotenv
DATABASE_URL=YOUR_COMPLETE_POOLED_NEON_CONNECTION_STRING
```

Copy your actual `DATABASE_URL` from the ignored local `.env` into Render's secret environment field. Its password is already included in the connection string; **no separate `POSTGRES_PASSWORD` setting is used**. Keep TLS/certificate verification enabled. Never expose this as `NEXT_PUBLIC_*`, commit it, or place it in GitHub workflow YAML. `sync: false` in the Blueprint reserves the secret field without publishing its value.

Render provides `PORT`; leave it unset. Docker runtime starts `node server/web.mjs`. If using Render's native Node runtime instead, install/build with `bun install --frozen-lockfile && bun run build`, start `bun start`, and use Node 24. Health check: `/api/collaboration-health`.

Free Render services can sleep. Sleeping/restarting interrupts live sessions, even though Neon preserves confirmed saves. No paid disk is required: `/tmp/knotleaf-rooms` contains only ephemeral recovery copies. Export any room content you want to retain before its 24-hour deadline. Recovery files without an authoritative room record are removed and cannot renew a room. Run one hub replica: PostgreSQL stores snapshots, but does not distribute live Yjs or signaling events between independent hubs.

## 3. Neon data and migrations

Use the pooled connection string from your Neon project. The existing generic `pg` driver supports Neon; a Neon-specific SDK is not installed. The configured `.env` connection is preserved when changing public URL settings.

```sh
bun run db:migrate
bun run db:check
```

These connect directly to Neon; neither command starts Docker or PostgreSQL locally. Migration creates `knotleaf_rooms` with room UUID, title, public invite URL/path, full Yjs state, a JSON snapshot of shapes/code/notes, and timestamps. The check verifies the schema and performs temporary reads/writes/updates in a rolled-back transaction. The room server also initializes the idempotent schema on first use after deployment.

Shared canvas, code and Markdown content is stored in Neon. Personal workspaces/history/templates remain browser-local; optional account identity does not enable private cloud storage. Presence, chat and call negotiation are ephemeral. Recordings download to your computer and are not uploaded to Neon.

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

Do not substitute `knotleaf-desk.vercel.app` or the Render web-service hostname into these fields unless an actual TURN service is reachable there. An HTTPS website is not a TURN endpoint. Vercel/ordinary Render web services do not expose the UDP relay ports needed for a normal coturn deployment. Running a container in CI does not make its relay ports reachable by students; CI jobs are temporary. A relay requires a reachable persistent host with suitable ports, or a compatible hosted relay offering. No relay host was provisioned here.

The ignored local `.env` contains a randomly generated `TURN_SHARED_SECRET` when previously empty. Copy it to Render **and to your relay's matching authentication-secret setting** if you provision a relay. This is not a database password. The shared secret stays server-only; browsers receive HMAC credentials valid for 12 hours. Public STUN is enabled and its binding response was verified from this environment. Keep `TURN_URLS` empty until a working relay is configured. Some NAT/firewall combinations will fail without TURN; STUN is not a replacement for it. Google documents this STUN endpoint at https://web.dev/articles/webrtc-infrastructure. The documented Open Relay static-auth endpoint timed out over UDP/TCP/TLS during checks here, so it was not enabled. This does not prove that endpoint is globally unavailable.

Calls use a small-group mesh, default 8 participants and a maximum of 12. Setting `CLASSROOM_MAX_PARTICIPANTS=100` does not create a 100-person conferencing server; values above 12 are clamped. Larger classes need an SFU architecture. No gRPC service is required for the current browser media/signaling protocol.

## 6. Run without local Docker

Local drawing, notes and room creation do not require Render, Neon or an internet connection to a room service. Preserve your existing `.env` and credentials.

```sh
bun install --frozen-lockfile
bun dev
```

Open `http://localhost:3000` in two tabs, create a room from Share and open its invite in the second tab. `bun dev` explicitly runs in local mode: the room API, canvas WebSocket and classroom signaling use this same local server; room documents persist in `.collab-data/`. Personal boards and room backups use browser localStorage. No changes to Render's origin allowlist or database settings are needed. Restarting the local server preserves its rooms. Local mode binds to loopback by default; use `--hostname YOUR_LAN_IP` for LAN access and open the site at that address.

To use an existing production build locally:

```sh
bun run build
bun run start:local
```

Runtime room configuration makes this work even when the build used hosted URLs. Local mode ignores hosted database/URL settings in memory without modifying `.env`. For testing the integrated Node hub against the configured database, use `bun run dev:hosted`; `bun start` also preserves configured production storage. Browser data and server room files are separate; clearing browser data does not delete rooms persisted on the local server.

## 7. Live call and recording verification

Create/open a shared room → Live call → name → Join call. Mic/camera start off. Screen sharing has its own track, so it can coexist with the camera. Minimize to keep drawing and editing; Leave call releases devices without leaving the board. Disconnection exposes Rejoin. Chat is temporary. Invite links grant editing and call access to anyone possessing the link; display names are not authenticated teacher/student accounts.

For local recording, select this app's tab, enable tab audio to capture remote voices, and optionally include your microphone. Stop & save downloads WebM (or MP4 if supported). Nothing uploads to the database. Recordings are held in memory and stop/save at 512 MB; split long lessons and save before closing the page. Screen/audio support varies by browser/OS; tell students before recording.

After deployment, test on two devices on different networks: edit canvas/code/notes, join, enable mic/camera, share a screen, minimize, record/save and leave. HTTPS is required outside localhost. If signaling connects but media fails, check the real relay settings and network/firewall. Unit tests and the server smoke test do not prove real-device media/NAT connectivity.

## Room retention

All rooms, including previously created rooms, have a fixed 24-hour lifetime based on their original creation timestamp. Activity never renews it. PostgreSQL reads/writes and local disk reads enforce the deadline, both WebSocket services close active sessions at expiry, and startup/minute cleanup removes expired records and recovery files. The `Expire rooms` GitHub Actions workflow calls the hub cleanup endpoint every 15 minutes so a sleeping Render host also gets cleanup requests; scheduled jobs can be delayed. Expired access is denied independently of cleanup timing. Personal boards remain; cached room copies and history are removed on expiry or the next app read. Unregistered legacy recovery files are removed rather than turned into fresh rooms.

### Call moderation and audio checks

Deploy the hub and frontend together. Startup schema migration adds nullable `host_token_hash`; `bun run db:check` verifies that column. Only newly created rooms receive a creator capability; legacy rooms remain participant-only. The creator's browser stores the raw capability outside board data and sends it only to the call signaling endpoint. The server stores a SHA-256 hash and authorizes every moderation command. Never put host capabilities in invite links or analytics. Co-host roles are session-only; removal disconnects media but does not ban the invitation holder from rejoining.

Verify with separate browser profiles: create as host, join the invite as participant, promote to co-host, mute another participant and remove with confirmation. Confirm participant clients cannot promote themselves or manage a host, and a pending microphone switch cannot undo a remote mute. Expanded call and screen views must display speaking and microphone states. Test actual speakers/headsets on two devices for echo/noise; browser constraints and automated synthetic media checks cannot prove acoustic quality. Screen/tab audio is opt-in; system/window audio tracks are excluded.

## Optional account sign-in

Configure account variables on the Next.js host, run `bun run auth:migrate` against its PostgreSQL database, and register the Google callback URI before enabling Google sign-in. See [account deployment and API contract](docs/auth.md). Account sessions are independent of the room host and do not change invite permissions.

## Fast room creation and short invites

Use the **same room database** for the Vercel `DATABASE_URL` and the Render `DATABASE_URL`. Vercel then creates durable rooms directly with the existing room schema/pool, without the extra Render HTTP hop or its cold-start wait. This uses server-only credentials; no database URL is exposed to the browser. If the frontend has no database URL, the previous origin-checked proxy remains available. A database failure returns an error rather than an unpersisted link.

Warmup prepares frontend storage, then the browser wakes the configured hub with its existing CORS-protected warmup endpoint. A pending host wake never blocks creation. Short `/r/CODE` and `/v/CODE` pages decode the full UUID locally and render the existing room app, so there is no third-party shortener or database lookup on the short-link path.

Direct creation improves time to a usable invite; it cannot make a sleeping free Render process handle video traffic before that process wakes. Keep the hub on always-running hosting if the actual first camera connection must consistently be immediate. This change does not alter the hosting plan or incur a paid upgrade.
