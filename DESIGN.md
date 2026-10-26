---
version: alpha
name: Knotleaf Desk
description: A local-first diagramming desk and Markdown notebook.
colors:
  background: '#121212'
  surface: '#18181b'
  border: '#27272a'
  primary: '#3b82f6'
  text: '#f4f4f5'
  muted: '#a1a1aa'
typography:
  sans:
    fontFamily: 'Inter, system-ui, sans-serif'
  mono:
    fontFamily: 'Fira Code, monospace'
  hand:
    fontFamily: 'Caveat, cursive'
rounded:
  DEFAULT: '0.5rem'
  panel: '0.75rem'
spacing:
  header: '2.75rem'
  toolbar-inset: '0.375rem'
components:
  button: {}
  drawer: {}
  notes: {}
  canvas: {}
---

# Knotleaf Desk Design System

## Overview

### Creative North Star
An engineering drawing desk: quiet charcoal chrome, a spacious canvas, and blue attachment ports that make diagram structure visible.

### Product context and register
Personal diagrams and project notes, primarily used on desktop with keyboard and pointer. English interface; no market-specific business rules. This is a product tool, not a marketing page. Repository README and current user instructions supply the product context. Preserve the existing dark identity. The branch-veined leaf mark is the expressive signature; controls remain familiar. Avoid decorative gradients, giant toolbars, and ornamental cards.

Runtime sources are canonical: `app/globals.css` owns global styles and scrollbar tokens; `app/layout.tsx` owns font variables; shared components own utility-class geometry; `draw/renderer.ts` owns canvas visuals and blue ports. This document records these implemented values, rather than generating a separate theme.

## Colors
Background #121212, surface #18181b, border #27272a, text #f4f4f5, muted #a1a1aa, primary #3B82F6. Blue means active/selected/connected. Existing semantic feedback and destructive tones remain; spacing/margin guides are red. Use labels and shapes alongside color. Forced-colors scrollbars use system colors.

## Typography
Inter for controls, Fira Code for Markdown source and coordinates, Caveat for hand lettering. Canvas text also offers Lora (serif), Nunito (rounded sans), Roboto Condensed and Patrick Hand (printed handwriting). The appearance picker keeps eight familiar families in a compact two-column quick group. At the user’s request it has no More fonts dropdown. FontSelect owns grouped options for selected Notes text and document appearance, deliberately retaining platform popup geometry. The shared catalogue has 31 families across Everyday, Serif, Handwriting, Playful & display, and Monospace; catalogue labels keep the interface font for legibility, while the canvas and note content show the chosen face. New choices include Fredoka, Baloo 2, Permanent Marker, Bangers, Lobster, Special Elite and elegant reading faces. `draw/fonts.ts` owns family IDs, labels, CSS-variable names and fallback stacks; `app/layout.tsx` bundles the corresponding Next fonts. Renderer, inline editor and picker use that shared mapping. Fonts are bundled by Next at build time. Notes use 16px Inter prose by default, with shared font choices and saved reading preferences; optional source uses 13px source with 24px line height. Controls remain compact without compromising focus indicators.

## Layout

Canvas editor placeholders inherit the chosen font and have explicit full-opacity muted text (#a1a1aa), with slate (#475569) on yellow sticky surfaces. Empty editors measure the complete hint, wrap it when constrained, and stay inside the canvas viewport. Font-load completion and viewport/split changes remeasure the editor. `app/globals.css` owns placeholder colors; `draw/inlineEditorLayout.ts` owns editor bounds.
44px fixed header, drawing tools inset 6px below it. Inspector is relative to the canvas, below the tools; it scrolls internally only when necessary. Notes split starts at 360px, is draggable and keyboard resizable; below 640px it becomes a vertically stacked split. Notes contain their own vertical scroll; long prose and code wrap instead of forcing horizontal scrolling. Toolbars wrap on narrow viewports. The canvas itself pans, never document-scrolls.

## Elevation & Depth
Borders and tonal surfaces establish hierarchy. Shadows are reserved for floating tools, menus and drawers. Modal backdrops darken the workspace. Avoid shadows on document content.

## Shapes
8px controls, 12px floating panels. Lucide icons use consistent strokes. The blue leaf Knotleaf mark is shared by header and website favicon.

## Components
Native buttons for actions. Active view buttons expose aria-pressed. Workspace and export quality selects deliberately use platform-owned native popups. Native dialog owns modal focus, Escape and background inertness. Inline board-deletion confirmation stays inside the workspace dialog and states the consequence. Enabled buttons have hover/pointer/focus states; disabled actions are muted. No browser confirm/alert flows.

Notes toolbar, outline, source editor and GFM preview share one owner in `DocEditor`. Renderer and engine share the same connector geometry for hit testing, labels, selection and exports. Endpoint handles reconnect; connector-body movement preserves attachments. `BoardsSidebar` owns local workspace navigation.

Motion is brief functional feedback. Reduced-motion styles disable decorative animation. The app avoids skeletons and unstable placeholders. Plain labels name actions and outcomes.

## Do's and Don'ts
- Do keep notes and drawings in the same board and make attachment ports visible.
- Do reuse the shared renderer for vector export.
- Don't claim cloud collaboration or successful saving without evidence.
- Don't hide necessary content scrollbars; eliminate horizontal overflow through wrapping.

Selection controls use four square corner resize handles and one circular attachment port per side. Side-center resize squares are omitted on connectable elements to avoid duplicate controls. The selection outline supports side resizing beside the connector dots, with directional resize cursors. Frames also keep their edge squares because they do not expose connectors.

The single-selection outline is solid and quiet. Successful shape and card creation returns to Select with the same blue outline, resize handles and connector points as a manually selected element. Clicking blank space clears the selection. Connection points belong to the selected element in Select mode; other elements reveal them only as Arrow-tool targets. Bound arrow endpoints use the blue accent. Port layers are painted once, and selection controls stay hidden while typing.

Canvas icons are standalone glyphs on transparent backgrounds, with no captions or badge cards. The appearance panel is 288px wide and constrained to the canvas viewport. Its fixed header shows a stable Appearance title and selection context, its settings area scrolls independently, and a fixed footer groups labelled selection actions. Secondary settings use native details. It follows the measured toolbar height. Drawing-tool shortcuts remain in tooltips and accessible keyboard metadata. Workspace rows use quiet surfaces and disclose move controls only when needed.

Knotleaf Desk combines the knot of connected diagrams with the leaf of a notebook. The export panel has one format selector and one content selector, with explicit editable/share-only guidance. The .knotleaf format is versioned JSON. Opening a backup always creates a new local board in the chosen workspace.

Smart guides use red #f87171 during manipulation only: dashed alignments, solid gap rulers, pixel labels and equal-spacing markers. Their strokes and labels stay constant in screen pixels across zoom. They do not appear on idle boards or in exports.

Board tools uses a single search/history/template dialog, keeping new capabilities out of the drawing chrome. Presentation controls sit in a compact bottom bar with a native frame picker and clear exit action. Snapshot/template rows share restrained borders, explicit actions and local-storage scope descriptions.

Code cards edit directly in the canvas, using the same position/zoom as their saved glyphs. The shared code-source CSS contract owns identical font, line height, tabs, ligatures and padding for the highlight and caret layers. Highlighting is restrained: muted mauve keywords, sage strings and gray comments; other syntax uses the normal text colour. No modal code editor. Classroom is a minimizable side panel so teaching and drawing can continue together; the Classroom component owns compact mic/camera/screen-share/leave controls, a participant grid and an explicit Chat toggle. Recording controls explain local save and audio capture limitations.

Classroom's nonmodal fixed panel is portaled to document.body. It must not inherit the blurred header's fixed-position containing block or stacking context. The trigger exposes expanded/controls semantics; minimizing/Escape restores trigger focus. Personal boards offer Create room & open classroom; the resulting room URL opens the panel and focuses the name field.

Classroom keeps a visible, selectable invite URL above join/call controls, with copy feedback and manual-copy fallback. Audio source is a native select: Auto names the active microphone after capture permission, device changes refresh choices, and choosing while muted never enables capture. Switching acquires before stopping the old source; device labels stay local. Screen sharing states whether tab/screen audio is included. InstallWebApp owns a quiet header action and body-portaled native instruction dialog; it captures browser install prompts, handles dismissal/failure and installed standalone state. The manifest uses standalone display and PNG icons. No offline caching or forced reloads: deployed website updates load on normal reopen/reload without disrupting ongoing edits/calls.

Document notes use one typography contract for textarea and highlighted source, one scroll owner, no forced minimum editor height, and preserved cursor/scroll across preview. Formatting operates on whole lines or selected text without inserting sample content; Tab/Shift+Tab handle selected lines. Outline excludes code fences and is capped relative to panel height. Canvas document cards start empty, preserve their surface while editing, and expose a compact icon toolbar with an explicit Finish action. They have a quiet border and no overlapping title label. Renderer list/quote alignment resets per line so preceding centered text cannot shift content.

RefreshWebApp is a compact header action beside the existing app controls. Its icon remains visible at narrow widths; the text label appears on wide screens. Busy state preserves button dimensions, reduced motion disables the spinner, and failures use a body-portaled dismissible alert above the canvas.

Double-clicking inside rectangles, diamonds and ellipses starts attached text in Select or non-destructive drawing tools. Active text/card creation and Eraser instead respond to the first press without waiting for double-click intent. Their screen-sized border band selects instead. Existing attached text reopens for editing; Alt+double-click remains supported. Other elements retain their selection/editing behavior. Lines reuse arrows’ center diamond and compact numeric bend field, with zero for straight. No new visual tokens or overlay patterns.

The separate Paint workspace and raster-editor code are removed. The whiteboard retains freehand drawing, shapes, text, connectors and existing embedded images. There is no Paint toolbar entry or `.kpaint` workflow.

ColorControl owns drawing/text color wells, editable hex fields and inline validation. Appearance offers Background color beside stroke/text color for shapes and cards, including muted swatches and No background. BackgroundStylePicker owns compact Solid/Hatch/Crosshatch/Dots buttons with visual previews; the canvas-background disclosure shares that picker. Choosing a color preserves its pattern. Bucket tools and fill transparency sliders remain removed. Rendering, persistence, collaboration and export preserve older filled artwork and custom backgrounds. Keep the existing #121212 canvas, original dot/grid contrast, white default stroke and original card/sticky backgrounds. New background colors and patterns apply only through explicit choices; never recolor existing artwork or change the canvas’s visual identity.

Appearance starts hidden on every fresh visit and never opens automatically. A compact palette button with an accessible name opens it; a clear close control or Escape hides it. Canvas owns its explicit session visibility, independent of selection and tools. Pencil supports uninterrupted freehand strokes without automatic selection chrome; other shapes retain ordinary Select-mode outlines and connectors.

Canvas space takes priority: standard drawing controls use compact 32px buttons in one scrollable row, with shortcut labels in tooltips. Focus view removes app chrome and the notes split, leaving only a 32px restore-control button. The saved layout returns when leaving focus view. Appearance is represented by a high-contrast 32px palette button (36px on narrow screens) until explicitly opened.

Text editing uses a concise “Start typing…” hint, with contextual hints for cards, labels and frame names. Formatting focus can move between the editor and Appearance without committing the draft. Edits update the commit snapshot synchronously; card text wraps, and oversized free text scrolls horizontally. Below desktop width, header actions use an explicit overflow menu to preserve canvas space without overlapping the view switcher.

Each stroke and background color section has an explicit More colors disclosure. ColorPalette owns independent expansion state, 50 predefined drawing shades and 50 distinct muted background shades. Expanded palettes use an eight-column grid inside the inspector scroll area; basic swatches stay compact. Selected swatches expose pressed semantics and hex names.

Text connectors use stable 8-unit padding outside the glyph/card bounds. Ports sit outside the side midpoints of each free-text selection outline. Text outline painting and resizing use tight glyph bounds without added outline padding; connector ports remain 8 units outside those glyph bounds; older text-bound arrows reconcile on load and remote snapshots without moving their content. Other shapes keep their established port geometry.

The drawing toolbar uses a subtle small shadow, preserving the original black canvas and grid contrast. Notes add explicit Find/Replace and Copy Markdown controls. Search is literal and case-aware, next/previous matches wrap, Enter/Shift+Enter and F3 navigate, and Escape returns to writing. Replace all is one local note change with an explicit Undo replace action; subsequent edits disable that undo to protect newer work. Search UI is hidden by default and note shortcuts take priority over global board search.

Notes-only mode fills the main area on desktop and narrow screens. The active find match uses an aligned background highlight over the existing syntax layer, so it remains visible while the search field has focus. Its read-only highlight layer follows the textarea scroll; finding does not add a second scroll owner. Shift+1 fits the board and Shift+2 fits selected artwork without changing the tool or selection.

The built-in Templates picker uses a body-level native dialog, charcoal surfaces, real diagram previews, local search and category filters. Its library has 12 editable layouts with consistent rows, columns, label padding and explicit title spacing. Add is the default; Replace current canvas is opt-in. Insertion focuses only the new diagram inside the usable viewport, including room for controls and an explicitly opened desktop Appearance panel. Starter documentation lives in Notes rather than an overlapping canvas card. Template insertion never opens Appearance or changes canvas colors.

Bug reporting lives in Board tools as a fourth section, preserving canvas space. BugReportForm owns the draft, optional browser/viewport/app-mode details, preview, copy status and external GitHub issue review. Nothing submits automatically. Browser details exclude URLs, board identifiers and content. Native inputs and the existing Board tools dialog own focus, scrolling and keyboard dismissal; clipboard failure opens and selects the report for manual copying.

A compact Report bug button stays visibly labeled at the bottom-left beside the zoom controls on desktop and mobile, opening the existing Board tools report section directly. Focus and presentation modes hide it with the other controls. It shares the charcoal control styling and adds no new panel owner.
At widths up to 360px, zoom controls use tighter spacing so the bottom-left report action remains separate. Local development disables the Next.js indicator that otherwise covers the report button.


Rough outlines retain the same normalized shape geometry as clean strokes: polygon vertices and line endpoints are anchored, corner arcs use equal radii, and both deterministic stroke passes close at the same seam. Subtle edge variation scales down on tiny shapes; pencil smoothing remains independent. Raster and SVG exports share renderer geometry.

RoomChat is the shared conversation UI for CollaborationPanel and Classroom. A room Chat action opens the native collaboration dialog and focuses its composer. Classroom’s visible Chat toggle exposes the same conversation near the top of its nonmodal panel, before or during a call; microphone/camera permissions are unnecessary for text chat. Both views keep drafts while hidden, show connection/error states, and use a bounded scrollable message log. Plain text only, with sender name and time. RoomSession owns synchronization and retains the last 100 messages until the room expires; messages are excluded from drawing history and portable board files. Chat controls retain existing charcoal surfaces and blue accents.


Free-text selection follows measured visible glyphs, including italic overhangs, underline, line alignment and rich-text markers. It excludes unused stored width/height and trailing blank lines. Logical alignment boxes stay unchanged so older text keeps its visible position. Measurement removes the old two-character minimum and hidden 12-unit margin. Selection lines sit directly at glyph bounds; connection ports remain 8 units outside content. Cards keep their intentional container padding. Font completion invalidates text-bound caches and realigns text connectors.

Diamond (kite) shapes honor Sharp/Rounded in Clean and Rough strokes. Rounded diamonds use four circular corner fillets with a shared radius, reduced uniformly for thin or tiny diamonds; rough samples follow those same arcs. Fill boundaries and strokes share the rounded geometry.

Canvas fill patterns paint the selected base color across the whole canvas first, then add a subtle contrast pattern. Solid/Hatch/Crosshatch/Dots retain black when black is selected; white checkerboard never leaks through an opaque background. Shape/card pattern transparency and the original drawing grid/dots remain independent. Canvas, PNG/PDF and SVG use drawCanvasBackground.


The leaf is the brand signature: one broad blue (#3B82F6) leaf with a branching dark vein on a charcoal tile, shared by header, workspace, favicon and installed icons. The full SVG wordmark pairs a restrained serif name with a small DESK label; control typography stays Inter. Theme colors and utility classes are restored exactly from commit f93d8e0: unmodified Tailwind blue utilities, blue-600 primary buttons with white glyphs/text, #3b82f6 focus rings, #3B82F6 selection/connector chrome, and #f87171 red spacing/margin guides. No custom blue palette or new primary-button treatment overrides them. Actual canvas background, original dot/grid patterns and saved drawing colors remain unchanged.

The only upload action lives in TopToolbar; BoardHeader has no upload action, including its overflow menu. Native multiple-file selection and canvas drop share one pipeline. Images keep original bytes and aspect ratio; other files use quiet charcoal attachment cards with a blue file glyph. Upload status/error is dismissible without shifting controls. All new assets are browser-local; the UI states their scope and natural browser storage capacity. Appearance remains explicitly controlled.

Eraser options use one compact panel below the drawing toolbar, native mode select, numeric screen-pixel diameter and +/- buttons. Positive finite sizes have no app maximum. Modes are All elements, Lines & freehand, and Shapes & cards. The circular blue preview follows the pointer; erasing removes whole touched objects, respects locks and commits one undo step.

Frame presentation clips artwork to the active frame and suppresses other frame boundaries, frame title tags, editing grid and collaborator cursors. Fit reserves 24px top/side margins and 88px below for slide controls, even for very large frames. Exiting restores the prior viewport and editing grid.

Reconcile drift: the blue primary and red spacing-guide roles remain as explicitly requested; the leaf logo replaces the old mark. Runtime utility classes and focus rings match f93d8e0 exactly while measurement guides retain red; artwork palettes and the black canvas retain their separate content roles.

Manifest identity, start URL, scope and manifest URL stay stable across branding updates. `next.config.ts` fingerprints icon contents and supplies NEXT_PUBLIC_BRAND_ICON_VERSION; `lib/brandAssets.ts` versions header/wordmark, favicon metadata, Apple icon and PWA icon URLs consistently. The manifest revalidates, allowing supporting browsers to discover changed icons for existing installations. Browser-owned identity review and OS launcher refresh timing remain outside app control. No forced reinstall, new app identity or automatic page reload is introduced.

The existing export menu also offers JPG and WebP beside PNG. All raster formats share canvas/selection scope and 1x/2x/3x resolution. PNG/WebP retain optional transparency; JPG states its opaque canvas background. Formats share the renderer and preserve locally embedded image bytes while decoding, and unsupported encoders show a recoverable error rather than downloading a mislabeled file.

Downloads default to the same canvas base color, grid/dots and drawing renderer. Transparent export explicitly omits canvas color and grid. Canvas PDF pages use the captured artwork aspect ratio, with no added title, branding/footer or white letterboxing. Notes PDF pages use the selected canvas base color, readable matching light/dark ink and bundled control font, with matching full-page margins.

Export preparation and controls stay responsive during large jobs: one lazily created encoding worker, bounded queue, transferable bitmap ownership, asynchronous compatibility fallback, timed resource cleanup and cooperative scene batches. Primary font readiness is cached per document FontFaceSet and retried after failures. Next build worker count is limited to two; no server process is spawned per upload/export.

Selection outlines and multi-selection bounds add no margin for any element. Card surfaces retain their intentional content padding as part of the actual card. Icon bounds use cached visible alpha measurements, removing transparent SVG viewBox whitespace/letterboxing without changing stored artwork geometry. Resize handles, hit testing, connectors and fitting share those content bounds; icon resizing preserves the opposite visible corner and aspect ratio. Pixel scans happen only once per icon resource, with a bounded cache.

The teaching Highlighter shares TopToolbar tool ownership (J shortcut) and draws a fixed red 4px screen-width trail. Each point disappears after 0.2 seconds, fading during its final 50ms. Separate pen strokes never join. CanvasEngine owns transient bounded point buffers and a 30fps expiry timer that stops when empty and clears on destroy. RoomSession shares bounded trails through awareness at most 20 times per second, validates peer data and uses point ages to tolerate clock differences. Strokes never enter scene elements, undo, local storage, room documents or exports; Appearance stays hidden unless explicitly opened. Tool selection stays active for repeated pointing.


Notes now open in visual writing mode. DocEditor owns the mode switch, rich formatting, outline, find/replace, safe links, table editing, sticky-note blocks and document undo/redo. lib/richNotes.ts owns the schema, Markdown bridge and search decorations. MarkdownNotesEditor retains the optional source/preview workflow; source is never the default. The editor uses ordinary Inter paragraphs, compact toolbar controls and a charcoal reading surface, with muted paper-colored blockquotes for sticky notes. No new sidebar opens automatically. Native paragraph-style selection accepts the platform popup. Existing headings, lists, checklists, tables, links, images and code round-trip through the existing Markdown storage/export and room note transport. Imported notes are not rewritten merely by opening them. New board IDs reset document undo history; peer updates are excluded from local undo history. Search/replace operates on readable text and keeps unrelated formatting; replacement is undoable. Copy notes copies readable plain text; Markdown download and optional source remain explicit.

Text-tool clicks start ordinary automatic-size text on pointer release; dragging chooses a writing area, and Shift constrains it to a square. The temporary area uses the same blue selection token without extra padding. A chosen text box keeps its width and minimum height, wraps words without inserting line breaks into stored content, and grows vertically to retain overflowing text. Resizing that area reflows text without changing the font size. Old free text keeps tight glyph bounds and font-scaling resize behavior. Text-box dimensions are intentional content extents, not automatically added outline margin. Inline editing, canvas rendering, connector ports, exports and storage share the same box geometry.


The expanded document workspace keeps a single horizontally scrolling formatting row, preserving writing space on narrow screens. Insert and font controls come first; familiar bold/italic controls precede advanced styles. NoteDocumentTools reuses draw/fonts.ts for all bundled fonts and lib/preferences.ts for private reader font/size/line-spacing/width. Content fonts, sizes, colors, highlights, underline, alignment, subscript and superscript are stored with the writing and shared through the existing room note transport. Page appearance is explicitly labeled as a reading preference on this device. Transient menus, focus writing and panels do not persist.

NoteInsertMenu owns searchable block/template discovery and / commands. It anchors within the notes region, supports arrows/Enter/Escape, leaves IME input alone, and shows an explicit no-results state. Six append-only templates cover lessons, meetings, daily journals, research, project briefs and decisions. Existing selected writing is retained by template, sticky-note and toggle insertion. Top-level duplication and up/down moves are undoable structural actions with separate history groups. Collapsible sections use accessible disclosure buttons and keep their saved open state.

NoteLinksPanel connects local note pages in the current workspace with stable ID links, linked-note creation, forward links and backlinks. Canvas supplies the current board title and storage callbacks, loading the note library only when explicitly requested. Ctrl/Cmd+click opens a linked note; missing local pages remain readable with a correction message. Styled HTML links and Markdown links both contribute backlinks, while code examples are ignored. Creating a linked note retains the active document; opening it switches to Notes without opening a sidebar.

lib/richNotes.ts is the canonical schema and safe renderer for visual editing, optional source preview and PDF capture. Advanced styled blocks serialize as schema-owned HTML within Markdown; ordinary documents keep ordinary Markdown. Font/color/size/alignment attributes are validated and imported scripts, event handlers and arbitrary CSS are discarded. NotePreview retains highlighted code. PDF expands collapsible content and preserves text styling; HTML/text downloads are explicit header actions. Exported HTML includes safe content, reading preferences and font fallback variables. HTML exports use installed/fallback fonts; PDF uses the bundled application fonts. Old react-markdown/remark-gfm dependencies were removed after consolidating rendering.

Room note updates use minimal document-range replacements rather than replacing the full editor state. The change keeps selection and undo mappings stable and avoids broadcasting normalization echoes. Empty paragraphs are reused when inserting a new block; note links preserve active typography and leave a trailing writing space.


Live call is the visible name for the existing Classroom component and signaling endpoint; old invite links remain valid. CallScreenView owns all screen tiles and one explicitly opened native dialog per tile. Enlarge offers Fit to window and scrollable Actual size; full screen targets the dialog’s inner surface (browsers reject full-screen requests on dialog elements). Closing restores trigger focus. Capture remains active while panels are minimized or Notes are open. Changing screens uses the native picker, acquires before replacing tracks, and preserves the current share on cancellation. Redetect microphones refreshes the native source select without capturing or enabling a muted microphone.

RoomSession remains the live room owner across Canvas/Notes/Split. Hidden canvas layouts retain their last backing-store dimensions; returning repaints the current scene. Online/pageshow/focus/visibility recovery reconnects stale sockets without replacing the CRDT or undo history. Healthy sockets stay connected, with a 30-second state-vector resync. Active rooms use Yjs for updates rather than importing another tab’s browser-cache snapshots or view mode.

Shared canvas text and sticky notes publish during inline editing and use per-element Y.Text character merging, alongside the existing code and Notes transport. Remote text updates preserve the active inline editor and map its selection around changed text; automatic focus never resets an already-focused editor. The room server migrates legacy text before initial synchronization and snapshots materialized text for recovery. Room persistence keeps one active storage write and one replaceable latest snapshot per room, with asynchronous recovery-file writes; live peer updates do not wait for disk/database persistence. This remains a single-hub small-group architecture; horizontal replicas require a shared event bus and media scaling requires an SFU.


Opening Live call or Share on a personal board starts one intent-only room-host/database warmup, deduplicated for a minute. It sends no board content and creates no room; failures remain recoverable through the ordinary Create action. Durable creation returns the runtime WebSocket endpoint, reused for 30 seconds on the current origin. A creator’s confirmed room skips redundant availability reads for at most 10 seconds, while server WebSocket admission still checks room existence/expiry. No background polling keeps a sleeping host awake. Room request payloads contain only shared board content; local uploaded bytes are excluded before cloning/serialization.


Live call exposes its shared RoomJoinForm before joining media. Call links and bare room IDs open the target call panel; Share reuses the same validation and preserves call intent in invite links. Same-origin joins use the app router; external invite hosts retain explicit navigation. Full screen is now a directly labeled screen-tile action beside Enlarge, with the same expanded dialog, browser fallback and focus restoration to the actual originating action.

Call microphone capture always requests echo cancellation, automatic gain control and mono voice input. Noise cancellation defaults on, can be changed live, retaining the microphone when the browser applies constraints, and persists in local preferences. UI reports when the browser explicitly says processing is unavailable. Screen audio defaults off; Include tab audio is explicit and takes effect on the next source choice. Capture excludes self-tab/system/window audio through supported browser hints, requests own-audio filtering and local-playback suppression where available, and removes returned monitor/window audio tracks before transmission. Video previews stay muted; PeerAudio remains the only remote playback owner.

Expanded Live call keeps a visible participant dock with speaking activity, microphone state and server-confirmed Host/Co-host/Participant labels. Each screen viewer reuses that dock inside its full-screen surface. Header Expand and Full screen actions remain next to chat/minimize; narrow layouts retain independent participant scrolling. A single silent AudioContext samples enabled microphone tracks at 10 Hz while the panel is visible, never screen audio, and closes when hidden or disconnected.

New room creators receive a private random host capability, stored separately from boards in this browser and hashed on the room server. Invite URLs, CRDTs, exports and participant broadcasts never contain it. Only the verified host may assign/remove co-hosts; moderators may mute/remove participants, never remotely enable devices. Co-hosts cannot manage the host or other co-hosts. Removal requires a focused native confirmation and disconnects the call; an invite still permits rejoining. Roles reset on rejoin, while the creator capability survives reload until room expiry or local deletion. Legacy rooms cannot establish ownership by joining first.

Call removal tears down devices and peer connections on the authoritative moderation message, before the signaling socket's close handshake completes. ClassroomSession owns this idempotent disconnection path and invalidates pending device acquisition.

Additional families disable Next font preloading. CanvasEngine requests only families used by its scene/current style and repaints after readiness; exports await only the used canvas/notes families. The renderer deduplicates readiness per FontFaceSet and family and retries failed export loads. Original font licenses live in third-party/fonts. This catalogue expansion is intentional; control fonts, primary blue and canvas background retain their existing owners.

Document/code card appearance differs only in muted default fill: charcoal #242428 for documents and blue-charcoal #111d2d for code. draw/cardAppearance.ts resolves the legacy shared #18181B solid default consistently in canvas/export painting, inline code editing and Appearance controls. Explicit custom colors, patterns, attachment cards, box geometry, text, borders and existing language labels remain unchanged. No new labels, headers or decorative card details are added.

Presentation is the fourth BoardHeader view beside Canvas, Split and Notes. PresentationWorkspace owns the Markdown editor, writing guide, slide navigation, private notes and audience presenter; PresentationThemes owns a native-dialog visual gallery of 12 professional themes with distinct typography, composition, borders and backgrounds. Native selects retain layout and export-format choices. SlideSurface keeps its last successful render visible while debounced work completes, discards obsolete results, and preserves preview dimensions. The shared presentation CSS and theme tokens drive preview, audience view and exports; canvas colors and drawing chrome remain unchanged. The slide footer reserves space for the existing bottom bug-report action. Narrow headers move secondary project/search actions into Board actions so all four views fit.

Presentations are explicitly local to this device, stored separately per board with a versioned editable backup. Notes/canvas integration appends content; uploads remain local data URIs. Private speaker notes never enter the audience surface, HTML or PDF. PDF capture is sequential in an isolated document, and diagrams/math/code load only when used. Theme selection uses visual cards because users need to compare rendered palettes and typography, rather than a text-only option list. A native confirmation names an imported presentation before replacing the current deck; deletion has an immediate Undo action. Canvas keyboard shortcuts are suspended while its surface is hidden.

Presentation themes span cinematic Keynote, warm Editorial, Nordic, Executive, Modern Report, Corporate, Blueprint, Solarized, Architect, Simple Dark, Classic Report and Swiss design families. Their type hierarchy, spacing, rules and composition differ visibly. Content font and size controls reuse the shared font catalogue, including bundled JetBrains Mono; Canvas adds it directly to its quick group. Library, insert palette and design settings use native dialogs. HTML documents retain their authored appearance in an isolated frame and hide irrelevant Markdown controls.

Presentation typography lives directly in the editor toolbar: one Font control applies to headings, prose, lists, tables and code; one Size control scales text together while retaining heading proportions. Preview, audience and exports use the same rules. Mathematical notation keeps its dedicated math font.

Presentation now includes an on-demand visual organizer with keyboard-accessible earlier/later, duplicate, delete and one-step Undo actions. Slide source, reveals and private notes stay together. Six story starters (project update, lesson, pitch, demo, workshop and decision) append after the active slide, preserve the current theme/content, and can be undone. Private speaker notes are edited as ordinary text beneath the preview; source stores JSON-encoded private comments, never audience content. The presenter timer can pause, resume, reset and show progress against an optional time goal without advancing slides. These controls retain the existing charcoal surfaces and blue focus/selection styling; no new persistent sidebar is added.

The Presentation Guide is an explicit native-dialog help workspace, closed by default. Start here links to real starter, organizer, design, check and presentation actions. Writing examples share the Insert catalogue, with instant local search, platform-owned category selection, clear/reset and no-results states, selectable Markdown, explicit insertion/copy, rendered previews and reveal playback. External sample media is never fetched by the guide. Dedicated sections explain delivery, export/privacy, actual editor/presenter shortcuts and troubleshooting. Closing restores Guide focus; inserting restores the saved source selection. The guide uses existing charcoal/blue styles and independent bounded scrolling on narrow screens.

AccountButton owns the optional account entry in BoardHeader and its compact native sign-in/account dialog. It reuses charcoal surfaces, blue-600 primary actions, Inter controls, visible labels and 8px/12px radii. Google and email/password share busy/error feedback; password visibility is explicit, signup requirements precede input, and the blue account trigger stays beside the view controls and becomes icon-only below 420px. The dialog is portaled to the body; its compact white Google button uses a multicolor mark. Only that button changes while Google connects, preserving the card and email controls until navigation. Accounts do not imply cloud board storage.

Canvas and split resizing share safe pointer-capture helpers. Canvas owns the pointer gesture; window fallbacks retain drags outside the surface when capture fails. Release applies only a changed final coordinate, avoiding ghost Pencil clicks. Native Control-click on Apple platforms remains a secondary action. The canvas is focusable and blocks native text selection, while button/link keyboard activation stays browser-owned. Safari pinch gestures zoom only the canvas; trackpad scroll momentum cannot pan during a drag. Split handles keep native focus/keyboard controls and use window-owned resize completion with a primary-pointer guard.

Explicit font-size changes update both the current text and the shared new-text default. CanvasEngine emits style changes for selected-text size shortcuts; inline size controls update that same default. Canvas persists it through the existing versioned preferences, so additional text and reloads keep the chosen size without altering older text merely on selection.

Shortcut labels explicitly name Command on Mac. Text-size actions share physical Period/Comma recognition across canvas, inline editing, Appearance and visual Notes; focused Appearance buttons retain native Space activation while handling the text-size chord locally. Canvas sizes use the existing 8–512px preference range rather than an unrelated 96px control cap.

Text-size shortcuts run before Escape handling because Mac browsers may deliver Cmd+Shift+Period as an Escape keydown. New sticky notes inherit the saved text size. Rich notes remember the last shortcut or size-input value as `noteTypingSize` and apply it as the typing style in paragraphs without an explicit size. Marquee selection ignores elements that fully enclose the dragged box and only re-renders React when the selection changes; a captured mouse drag reporting no buttons waits for its real release.

Shape, frame, line and arrow tools support Excalidraw-style click-to-draw: a press released within 4px keeps the draft gesture in `clickMode`, the draft follows hover moves, and the next primary click (or Escape) finishes it through the normal `finishDraft` path. Press-and-drag is unchanged; Pencil still draws only while pressed. Tool switches, blur and context menu cancel an unfinished click-mode draft.

Arrows default to straight routing. With the Arrow tool, starting or ending inside a shape binds to that shape's anchor facing the other end (recomputed as the pointer moves); an end still inside the start shape leaves the arrow unbound so clicks inside a shape draw nothing. In Select, only the visible 7px connection dot starts an arrow, and clicking a dot without dragging never enters click-to-draw.

Safari reports a second trackpad finger (one finger holding the click, another dragging) as gesturestart. While a pointer gesture is active, gesture events are ignored instead of cancelling the drag, matching how wheel input is already ignored mid-drag. Header actions stay inline only from 1440px; below that (13" MacBooks at 1280–1439px) they live in the ⋯ menu so the title, save status and view switcher never wrap or truncate.

Drawing tools act on the first press, including over existing content; no 500ms intent timer delays creation or erasing. Fast Pencil input retains browser-coalesced samples where available, with a normal-event fallback. Its transient point buffer grows in place while paints remain frame-aligned; committed scene snapshots and undo history remain immutable.

Drawing-toolbar icon buttons use TooltipButton for immediate hover and keyboard-focus labels with shortcuts. Labels are portaled outside the scrolling toolbar, constrained to the viewport, and use the existing charcoal surface, muted border and small interface type. Disabled history/upload actions still expose their labels; Escape, scrolling and resizing dismiss them.
