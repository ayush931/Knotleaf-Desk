<p align="center"><img src="public/icons/mark.svg" width="88" height="88" alt="Whiteboard connected-node icon" /></p>

# Whiteboard

An open-source, local-first whiteboard and Markdown notebook. Draw diagrams, connect ideas, and keep project notes in one place. Use it in a browser, install it as a PWA, or build a desktop app for Linux, Windows, and macOS. No account, database, subscription, or API key is required for core features.

## Features

- **Attached connectors:** magnetic top/right/bottom/left ports, visible connection placeholders, straight/curved/elbow routing, editable labels, endpoint caps and animated flow. Elbow paths respect both attachment directions and avoid their connected shapes. Move or resize shapes and the endpoints follow their exact ports. Dragging an arrow body preserves attachments; drag an endpoint to reconnect or detach it.
- **Connect without dragging:** select shapes in sequence with Shift, then choose **Connect selected**. Multi-selection also offers Align left, Align top and Space evenly.
- **Canvas tools:** rectangles, diamonds, ellipses, freehand, text, sticky notes, frames, document cards, eraser, grid/snap, pan/zoom, undo/redo, duplication, resizing, layers and presentation mode.
- **Notes beside drawings:** Canvas / Split / Notes views. Drag the split divider, use arrow keys when it is focused, or double-click to reset. On narrow screens the split stacks vertically. Long notes scroll vertically; text and code wrap to avoid horizontal scrollbars.
- **Markdown notebook:** headings, bold/italic, lists, checklists, code blocks, quotes, tables, links, safe rendered preview, heading outline, word count and reading time. Ctrl/Cmd+B and Ctrl/Cmd+I format selections; Enter continues lists/checklists; Tab indents source. Download notes as `.md`.
- **Local workspaces:** create workspaces, organize/move boards, search, duplicate, import, and confirm deletion. Existing boards remain in Personal workspace. Workspaces are local folders rather than cloud teams.
- **Architecture library:** bundled cloud, database, language and infrastructure glyphs; optional online Iconify search; diagram templates.
- **Exports without watermarks:** PNG at 1x/2x/3x, SVG vectors, editable draw.io diagrams, lossless board JSON and Markdown. Export the whole board or just the selected elements; PNG/SVG support transparent backgrounds.
- **Collaboration rooms:** share an invite link, edit shapes and Markdown together, see presence and canvas cursors, and reconnect with CRDT updates. The included WebSocket service persists room documents to disk.
- **Offline and desktop:** local persistence, installable PWA, sandboxed Electron wrapper, new shared application icon, and automated desktop build workflows.

## Run locally

Copy `.env.example` to `.env` for local settings (the working copy already includes local defaults).

Install [Node.js 24](https://nodejs.org/) and [Bun 1.4.3 or newer](https://bun.sh/).

```sh
bun install
bun dev
```

Open `http://localhost:3000`. If that port is occupied, Next.js prints the available port.

```sh
bun run typecheck
bun run lint
bun test
bun run build
bun start
```

The project uses patched Next.js 16.4.2 and React 19.3.1. Keep them updated; do not bypass deployment security blocks.

Next.js downloads Inter, Caveat and Fira Code during the build; build machines need internet access. They are bundled in the result. Online icon search also needs internet; core drawing and notes do not.

## Install as an application

### Browser / PWA

Run the production build (`bun run build`, then `bun start`) or host the app with HTTPS. Use **Install app** in the header when available, or your Chromium browser's install menu. This works on Windows, Linux and macOS with a compatible browser. Service-worker offline caching runs in production. Browser support for installation varies.

### Native desktop packages

The Electron app bundles its own local web server, so end users do not need Bun, Node.js, or a network connection to open it. Build on each target OS:

```sh
bun install
bun run desktop:build
```

Installers are written to `release/`:

| Build host | Generated packages |
|---|---|
| Linux | `.AppImage`, `.deb` |
| Windows | NSIS `.exe` installer |
| macOS | `.dmg`, `.zip` |

`bun run desktop:pack` produces an unpacked app for smoke testing. `bun run desktop:prepare` builds and stages the bundled server; `bun run desktop:start` runs that staged build. For development, start `bun dev` in one terminal and `bun run desktop:dev` in another (development expects port 3000).

Desktop uses the stable address `http://127.0.0.1:47831`, bound only to loopback. Only one app instance runs at a time. If another process occupies that port, the app explains the startup error. Browser and desktop boards are stored separately; use JSON export/import to transfer boards.

Linux needs a graphical desktop and Electron's system libraries. AppImage may require FUSE; consult your distribution's guidance or use the `.deb` build. macOS/Windows production signing requires maintainer-owned certificates. Current pipeline builds are unsigned; successful packaging is not a substitute for installation testing on each OS.

## Hosting and Vercel

A full deployment needs a persistent Node server for shared rooms. The included [Dockerfile](Dockerfile) and [render.yaml](render.yaml) run the integrated app and WebSocket hub together. Mount durable storage at `/data/rooms`, and forward WebSocket upgrades to `/collaboration/`. Personal boards stay in each user's browser; room data is held on the host's persistent disk. The Render example uses a paid service/disk because rooms need durable hosting; you can use your own machine or any compatible Node/Docker host instead.

Vercel's standard Next.js deployment builds the `app/` routes; it does **not** execute this repository's custom `server/web.mjs`. Thus the included in-memory/disk room hub is not running there. Deploy the room service on a persistent host and configure **NEXT_PUBLIC_COLLAB_URL=wss://your-room-host** in Vercel's project environment, then rebuild/redeploy. The client needs that public value at build time. A standalone room host accepts room paths at its root; the integrated Docker app uses `wss://your-app-host/collaboration`.

The app's health route detects missing room configuration and explains how to enable sharing, instead of creating a room that can never connect. Vercel can host the personal board/notes frontend independently. Never point a deployed site at `ws://localhost` and expect other users to reach your computer.

For the security block reported by Vercel, the dependency and Bun lockfile have been upgraded. Redeploy the updated commit with `bun install --frozen-lockfile` and `bun run build`; the installed version must match package.json. No project has been deployed from this local session.

## Automatic app builds and releases

`.github/workflows/ci.yml` runs typecheck, lint, regression tests and the web build on pushes and pull requests.

`.github/workflows/desktop.yml` builds Linux, Windows and macOS installers **on every branch push**, version tag, or manual **Run workflow**. Each platform builds on its own runner. Download the generated packages from the run's **Artifacts** section; artifacts are retained for 14 days. Branch builds receive versions such as `0.1.0-dev.42`.

To publish a versioned release after reviewing the changes:

```sh
# Example: choose your actual release version.
git tag v1.0.0
git push origin v1.0.0
```

The workflow builds all three platforms and attaches installers to a GitHub Release with generated notes. Release tags must follow semantic versioning. GitHub Actions must be enabled and the tag-release job needs its declared `contents: write` permission. The pipeline is configured in this repository; no workflow has been triggered or release published by making these local changes.

Automatic builds generate new installers; **in-app automatic updating is not implemented**. Install a newer package to update. Add signing/notarization and target-OS smoke testing before recommending public binaries for production use.

## Workspaces, notes, and storage

Open the top-left menu, create a workspace with **+**, and use **New board**. The per-board workspace picker moves a board. Search filters the current workspace. A board contains its canvas, Markdown notes, view mode, grid and snap settings. Switching boards restores those settings and resets the camera/diagram undo history.

Personal data lives in localStorage (`excali_eraser_*` keys). It stays on your device; there is no automatic cloud backup, encryption, or account synchronization. Shared rooms additionally synchronize through the collaboration server described below. Browser data clearing can delete boards. Export JSON backups regularly. If saving fails because storage is full or unavailable, the header shows **Not saved · retry**; export JSON before closing.

Canvas undo/redo covers diagram edits. Notes use normal textarea editing history; the Markdown formatting helpers perform source edits. Clearing a board removes its canvas and notes; only the canvas change is in the canvas undo history. Deleting a board is permanent after confirmation. Another tab can reload the active board from browser storage; simultaneous multi-tab editing does not provide conflict merging, so edit a board in one tab at a time.

## Collaboration rooms

Use **Share → Create room from this board** to create a shared copy, then copy the invite link. Other people open the link to join the same canvas and notes. Set your display name in the room panel. Presence and cursors are ephemeral. Yjs merges concurrent Markdown edits and changes to different shapes; simultaneous edits to the same shape resolve to one shared element value. Room undo uses Yjs and targets your own changes.

`bun dev` and `bun start` automatically start the web app and room server together on the same port. Use these commands rather than calling `next dev` / `next start` directly. WebSocket traffic uses **/collaboration/** on the same origin; room health is available at **/api/collaboration-health**. Documents persist in **.collab-data/**. An optional standalone `bun run collab:server` listens on port 3002 for deployments that deliberately separate the services. Back up that directory to preserve room history; browser JSON exports also preserve the current board. Graceful shutdown flushes documents. Persistence is debounced, so a process crash can lose the latest fraction of a second of server changes; reconnecting clients retain their CRDT state in memory.

For LAN use, run both services on a reachable interface, then invite using the server's LAN hostname/IP:

```sh
# After building; exposes both the board and its room service:
bun start --hostname 0.0.0.0
```

For HTTPS hosting, forward **/collaboration/** WebSocket upgrades through your reverse proxy to the app. The client automatically uses WSS on HTTPS pages. No separate public port or URL is needed. Set `NEXT_PUBLIC_COLLAB_URL` before building only if you deliberately use a separate room host. Example environment configuration is in `.env.example`:

```sh
NEXT_PUBLIC_COLLAB_URL=wss://rooms.example.com bun run build
COLLAB_ORIGINS=https://board.example.com bun start
```

App server options: `PORT`, `WEB_HOST`, `COLLAB_DATA_DIR`, and comma-separated `COLLAB_ORIGINS`. `COLLAB_HOST` / `COLLAB_PORT` apply only to the optional standalone room service. The origin allowlist is optional for local development and recommended for deployment. Room IDs are random UUIDs and act as **edit capabilities**: anyone possessing the invite link can read/edit that room. There are no account roles, authentication, moderation, quotas or revocation controls. Host behind your own authentication/access gateway for private teams; this server is intended for personal/trusted collaboration rather than an unrestricted public multi-tenant service.

Desktop packages bundle the same integrated room server at **127.0.0.1:47831/collaboration**, storing room files under Electron's user-data directory. Localhost invitations work on the same computer. To collaborate across devices, use a reachable self-hosted web deployment, or build the desktop client with `NEXT_PUBLIC_COLLAB_URL` pointing at your hosted WSS server. Use the hosted web origin when sharing links with other devices.

The room initially waits for a server sync before enabling edits, preventing a stale local board from overwriting shared content. After connecting once, temporary disconnects preserve in-memory edits and synchronize on reconnect; do not close a disconnected tab before it reconnects or before exporting a JSON backup.

## Export formats and limits

| Format | Purpose | Notes |
|---|---|---|
| `.json` | Editable backup and transfer | Preserves canvas, notes and settings; importing creates a new board ID |
| `.svg` | Scalable vector artwork | Shared renderer records paths and text; shadows are omitted, fonts must exist on the viewing machine |
| `.drawio` | Editable diagrams.net interchange | Shapes, text, labels, ports and connector waypoints; freehand/icon artwork is simplified to labeled shapes |
| `.png` | Sharing images | 1x/2x/3x; solid or transparent background |
| `.md` | Notes in other Markdown apps | Exports the current board's Markdown source |

Selection export applies to PNG, SVG and draw.io. JSON always backs up the full board. Very large raster exports are limited by the browser's maximum canvas/memory; SVG or JSON is preferable for large boards. PDF/PowerPoint/Visio export and cloud sharing are not included.

## Keyboard shortcuts

Press **?** in the app for the drawing shortcuts.

| Action | Shortcut |
|---|---|
| Select / Pan | V / H; hold Space to pan |
| Rectangle / Diamond / Ellipse | R / D / O |
| Arrow / Line / Pencil | A / L / P |
| Text / Document card / Sticky / Frame | T / N / S / F |
| Eraser / Icons | E / I |
| Undo / Redo | Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z |
| Copy / Cut / Paste / Duplicate / Select all | Ctrl/Cmd+C / X / V / D / A |
| Edit a label or shape text | Double-click |
| Finish canvas text editing | Ctrl/Cmd+Enter |
| Notes bold / italic | Ctrl/Cmd+B / Ctrl/Cmd+I |
| Resize split | Focus divider, use arrows; Home / End; double-click to reset |

## Codebase

```text
app/                 Next.js routes, global styles, fonts, PWA metadata
components/          Canvas shell, notes editor, workspace drawer and tools
draw/CanvasEngine.ts Pointer gestures, attachment lifecycle, history and arrangement
draw/renderer.ts     Shared drawing, label layout, bounds and hit geometry
draw/connectorRouting.ts Orthogonal routing with fixed outward-facing ports
draw/svgExport.ts    Vector recorder using the shared renderer
draw/drawioExport.ts Editable diagrams.net export
lib/storage.ts       Local board/workspace persistence and import validation
lib/collaboration.ts  Yjs shared state, notes merging and presence
server/              Persistent WebSocket collaboration service
desktop/             Sandboxed Electron application shell
scripts/             Desktop staging and CI versioning
.github/workflows/   Web checks and per-update desktop packages/releases
tests/               Routing, engine attachment and storage regressions
```

## Contribute and license

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), [DESIGN.md](DESIGN.md), and [UX-CONTRACT.md](UX-CONTRACT.md). The project is [MIT licensed](LICENSE). Dependencies, fonts and logos retain their own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Core libraries: [Next.js](https://nextjs.org/), [React](https://react.dev/), [Lucide](https://lucide.dev/), [react-markdown](https://github.com/remarkjs/react-markdown), [Electron](https://www.electronjs.org/), and [electron-builder](https://www.electron.build/). Diagram workflow draws inspiration from [Excalidraw](https://excalidraw.com/) and [Eraser](https://www.eraser.io/), with no affiliation.
