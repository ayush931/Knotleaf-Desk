# Whiteboard interaction contract

The current user brief and README define a personal, local-first tool. No server account, billing, or team permissions are implied by a local workspace. Explicitly shared rooms synchronize through a configured WebSocket service using UUID invite capabilities.

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Select/Listbox | Native select in BoardsSidebar and BoardHeader | DESIGN.md | Platform-owned workspace, move and PNG quality popups | Typecheck; manual browser check still required |
| Scrollbar | app/globals.css | DESIGN.md | Notes, inspector and board list own vertical scroll | Static audit |
| CRUD | lib/storage.ts and Canvas.tsx | README storage model | Local board/workspace create, rename, move, duplicate, import; destructive confirmation | tests/storage.test.mjs |
| Modal | Native dialog in BoardsSidebar and ConfirmDialog | DESIGN.md | Workspace drawer and clear confirmation | Browser focus check still required |
| Notes | DocEditor.tsx | README | Source and safe GFM preview; editable independently from canvas | Typecheck and build |
| Connectors | CanvasEngine, renderer, connectorRouting | User requirement for fixed attachments | Straight, curved, orthogonal; explicit endpoint drag may detach | tests/connectors.test.mjs, tests/engine.test.mjs |

In personal boards, canvas undo/redo covers diagram edits; native textarea editing history covers typed notes. Board changes reset selection/history and viewport. Board metadata includes notes, view mode, grid and snap settings. Existing boards without a workspace belong to Personal workspace. Creating an empty workspace does not remove or switch the currently displayed board. Clicking a board selects it and closes the workspace drawer; moving it updates its stored workspace.

Workspace names are required and limited to 80 characters. Search is local and immediate with an explicit clear action. Deleting a board requires an inline confirmation that names the board and includes its notes. Clearing a board requires a modal confirmation; canvas removal is undoable but removed notes are not in canvas history. Imports create new IDs and never replace an existing board. JSON is the lossless editable backup; SVG and draw.io are interchange exports.

Split dragging has arrow-key, Home and End alternatives and a double-click reset. Main canvas has no document scroll. Pointer capture keeps a split drag active outside the handle. Notes and preview wrap long content. IME composition is excluded from editing shortcuts.

Desktop owns a sandboxed Electron renderer, loopback-only bundled Next and collaboration servers and a stable local origin. Browser and desktop data stores are separate. External HTTPS links open in the system browser; no Node API is exposed to notes. Every pushed update builds installers in GitHub Actions; tags publish releases. Code signing requires the maintainer's credentials and is not fabricated.

RoomSession owns Yjs elements, collaborative Markdown text, local-origin undo and awareness. Room edits unlock after first sync. Once initialized, offline edits remain in the live Y.Doc and merge on reconnect. Same-element concurrent shape edits resolve to one CRDT map value; notes use character-level merge. Server room documents persist on disk, with UUID paths validated before accepting sockets. tests/collaboration.test.mjs exercises real two-client sync, presence and persistence.
