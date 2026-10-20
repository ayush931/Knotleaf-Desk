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
An engineering drawing desk: quiet charcoal chrome, a spacious canvas, and bright blue attachment ports that make diagram structure visible.

### Product context and register
Personal diagrams and project notes, primarily used on desktop with keyboard and pointer. English interface; no market-specific business rules. This is a product tool, not a marketing page. Repository README and current user instructions supply the product context. Preserve the existing dark identity. The branching K and leaf mark is the expressive signature; controls remain familiar. Avoid decorative gradients, giant toolbars, and ornamental cards.

Runtime sources are canonical: `app/globals.css` owns global styles and scrollbar tokens; `app/layout.tsx` owns font variables; shared components own utility-class geometry; `draw/renderer.ts` owns canvas visuals and blue ports. This document records these implemented values, rather than generating a separate theme.

## Colors
Background #121212, surface #18181b, border #27272a, text #f4f4f5, muted #a1a1aa, primary #3b82f6. Blue means active/selected/connected. Rose indicates destructive actions. Use labels and shapes alongside color. Forced-colors scrollbars use system colors.

## Typography
Inter for controls, Fira Code for Markdown source and coordinates, Caveat for hand lettering. Canvas text also offers Lora (serif), Nunito (rounded sans), Roboto Condensed and Patrick Hand (printed handwriting). The appearance picker previews each named family in a compact two-column button group with selected-state semantics. `draw/fonts.ts` owns family IDs, labels, CSS-variable names and fallback stacks; `app/layout.tsx` bundles the corresponding Next fonts. Renderer, inline editor and picker use that shared mapping. Fonts are bundled by Next at build time. Notes use 13px source with 24px line height and 14px rendered prose. Controls remain compact without compromising focus indicators.

## Layout

Canvas editor placeholders inherit the chosen font and have explicit full-opacity muted text (#a1a1aa), with slate (#475569) on yellow sticky surfaces. Empty editors measure the complete hint, wrap it when constrained, and stay inside the canvas viewport. Font-load completion and viewport/split changes remeasure the editor. `app/globals.css` owns placeholder colors; `draw/inlineEditorLayout.ts` owns editor bounds.
44px fixed header, drawing tools inset 6px below it. Inspector is relative to the canvas, below the tools; it scrolls internally only when necessary. Notes split starts at 360px, is draggable and keyboard resizable; below 640px it becomes a vertically stacked split. Notes contain their own vertical scroll; long prose and code wrap instead of forcing horizontal scrolling. Toolbars wrap on narrow viewports. The canvas itself pans, never document-scrolls.

## Elevation & Depth
Borders and tonal surfaces establish hierarchy. Shadows are reserved for floating tools, menus and drawers. Modal backdrops darken the workspace. Avoid shadows on document content.

## Shapes
8px controls, 12px floating panels. Lucide icons use consistent strokes. The blue/white Knotleaf mark is shared by header and website favicon.

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

The single-selection outline is solid and quiet. Successful shape and card creation returns to Select with the same blue outline, resize handles and connector points as a manually selected element. Clicking blank space clears the selection. Connection points belong to the selected element in Select mode; other elements reveal them only as Arrow-tool targets. Bound arrow endpoints use the existing blue accent. Port layers are painted once, and selection controls stay hidden while typing.

Canvas icons are standalone glyphs on transparent backgrounds, with no captions or badge cards. The appearance panel is 288px wide and constrained to the canvas viewport. Its fixed header shows a stable Appearance title and selection context, its settings area scrolls independently, and a fixed footer groups labelled selection actions. Secondary settings use native details. It follows the measured toolbar height. Drawing-tool shortcuts remain in tooltips and accessible keyboard metadata. Workspace rows use quiet surfaces and disclose move controls only when needed.

Knotleaf Desk combines the knot of connected diagrams with the leaf of a notebook. The export panel has one format selector and one content selector, with explicit editable/share-only guidance. The .knotleaf format is versioned JSON. Opening a backup always creates a new local board in the chosen workspace.

Smart guides use soft red #f87171 during manipulation only: dashed alignments, solid gap rulers, pixel labels and equal-spacing markers. Their strokes and labels stay constant in screen pixels across zoom. They do not appear on idle boards or in exports.

Board tools uses a single search/history/template dialog, keeping new capabilities out of the drawing chrome. Presentation controls sit in a compact bottom bar with a native frame picker and clear exit action. Snapshot/template rows share restrained borders, explicit actions and local-storage scope descriptions.

Code cards edit directly in the canvas, using the same position/zoom as their saved glyphs. The shared code-source CSS contract owns identical font, line height, tabs, ligatures and padding for the highlight and caret layers. Highlighting is restrained: muted mauve keywords, sage strings and gray comments; other syntax uses the normal text colour. No modal code editor. Classroom is a minimizable side panel so teaching and drawing can continue together; the Classroom component owns compact mic/camera/screen-share/leave controls, a participant grid and an explicit Chat toggle. Recording controls explain local save and audio capture limitations.

Classroom's nonmodal fixed panel is portaled to document.body. It must not inherit the blurred header's fixed-position containing block or stacking context. The trigger exposes expanded/controls semantics; minimizing/Escape restores trigger focus. Personal boards offer Create room & open classroom; the resulting room URL opens the panel and focuses the name field.

Classroom keeps a visible, selectable invite URL above join/call controls, with copy feedback and manual-copy fallback. Audio source is a native select: Auto names the active microphone after capture permission, device changes refresh choices, and choosing while muted never enables capture. Switching acquires before stopping the old source; device labels stay local. Screen sharing states whether tab/screen audio is included. InstallWebApp owns a quiet header action and body-portaled native instruction dialog; it captures browser install prompts, handles dismissal/failure and installed standalone state. The manifest uses standalone display and PNG icons. No offline caching or forced reloads: deployed website updates load on normal reopen/reload without disrupting ongoing edits/calls.

Document notes use one typography contract for textarea and highlighted source, one scroll owner, no forced minimum editor height, and preserved cursor/scroll across preview. Formatting operates on whole lines or selected text without inserting sample content; Tab/Shift+Tab handle selected lines. Outline excludes code fences and is capped relative to panel height. Canvas document cards start empty, preserve their surface while editing, and expose a compact icon toolbar with an explicit Finish action. They have a quiet border and no overlapping title label. Renderer list/quote alignment resets per line so preceding centered text cannot shift content.

RefreshWebApp is a compact header action beside the existing app controls. Its icon remains visible at narrow widths; the text label appears on wide screens. Busy state preserves button dimensions, reduced motion disables the spinner, and failures use a body-portaled dismissible alert above the canvas.

Double-clicking inside rectangles, diamonds and ellipses starts attached text across tools. Their screen-sized border band selects instead. Existing attached text reopens for editing; Alt+double-click remains supported. Other elements retain their selection/editing behavior. Lines reuse arrows’ center diamond and compact numeric bend field, with zero for straight. No new visual tokens or overlay patterns.

The separate Paint workspace and raster-editor code are removed. The whiteboard retains freehand drawing, shapes, text, connectors and existing embedded images. There is no Paint toolbar entry or `.kpaint` workflow.

ColorControl owns drawing/text color wells, editable hex fields and inline validation. Appearance offers Background color beside stroke/text color for shapes and cards, including muted swatches and No background. BackgroundStylePicker owns compact Solid/Hatch/Crosshatch/Dots buttons with visual previews; the canvas-background disclosure shares that picker. Choosing a color preserves its pattern. Bucket tools and fill transparency sliders remain removed. Rendering, persistence, collaboration and export preserve older filled artwork and custom backgrounds. Keep the existing #121212 canvas, original dot/grid contrast, white default stroke and original card/sticky backgrounds. New background colors and patterns apply only through explicit choices; never recolor existing artwork or change the canvas’s visual identity.

Appearance starts hidden on every fresh visit and never opens automatically. A compact palette button with an accessible name opens it; a clear close control or Escape hides it. Canvas owns its explicit session visibility, independent of selection and tools. Pencil supports uninterrupted freehand strokes without automatic selection chrome; other shapes retain ordinary Select-mode outlines and connectors.

Canvas space takes priority: standard drawing controls use compact 32px buttons in one scrollable row, with shortcut labels in tooltips. Focus view removes app chrome and the notes split, leaving only a 32px restore-control button. The saved layout returns when leaving focus view. Appearance is represented by a high-contrast 32px palette button (36px on narrow screens) until explicitly opened.

Text editing uses a concise “Start typing…” hint, with contextual hints for cards, labels and frame names. Formatting focus can move between the editor and Appearance without committing the draft. Edits update the commit snapshot synchronously; card text wraps, and oversized free text scrolls horizontally. Below desktop width, header actions use an explicit overflow menu to preserve canvas space without overlapping the view switcher.

Each stroke and background color section has an explicit More colors disclosure. ColorPalette owns independent expansion state, 50 predefined drawing shades and 50 distinct muted background shades. Expanded palettes use an eight-column grid inside the inspector scroll area; basic swatches stay compact. Selected swatches expose pressed semantics and hex names.

Text connectors use stable 8-unit padding outside the glyph/card bounds. Ports sit outside the side midpoints of each free-text selection outline. Text outline painting and resizing use tight glyph bounds with 2-unit padding for free text; connector ports remain 8 units outside those glyph bounds; older text-bound arrows reconcile on load and remote snapshots without moving their content. Other shapes keep their established port geometry.

The drawing toolbar uses a subtle small shadow, preserving the original black canvas and grid contrast. Notes add explicit Find/Replace and Copy Markdown controls. Search is literal and case-aware, next/previous matches wrap, Enter/Shift+Enter and F3 navigate, and Escape returns to writing. Replace all is one local note change with an explicit Undo replace action; subsequent edits disable that undo to protect newer work. Search UI is hidden by default and note shortcuts take priority over global board search.

Notes-only mode fills the main area on desktop and narrow screens. The active find match uses an aligned background highlight over the existing syntax layer, so it remains visible while the search field has focus. Its read-only highlight layer follows the textarea scroll; finding does not add a second scroll owner. Shift+1 fits the board and Shift+2 fits selected artwork without changing the tool or selection.

The built-in Templates picker uses a body-level native dialog, charcoal surfaces, real diagram previews, local search and category filters. Its library has 12 editable layouts with consistent rows, columns, label padding and explicit title spacing. Add is the default; Replace current canvas is opt-in. Insertion focuses only the new diagram inside the usable viewport, including room for controls and an explicitly opened desktop Appearance panel. Starter documentation lives in Notes rather than an overlapping canvas card. Template insertion never opens Appearance or changes canvas colors.

Bug reporting lives in Board tools as a fourth section, preserving canvas space. BugReportForm owns the draft, optional browser/viewport/app-mode details, preview, copy status and external GitHub issue review. Nothing submits automatically. Browser details exclude URLs, board identifiers and content. Native inputs and the existing Board tools dialog own focus, scrolling and keyboard dismissal; clipboard failure opens and selects the report for manual copying.

A compact Report bug button stays visibly labeled at the bottom-left beside the zoom controls on desktop and mobile, opening the existing Board tools report section directly. Focus and presentation modes hide it with the other controls. It shares the charcoal control styling and adds no new panel owner.
At widths up to 360px, zoom controls use tighter spacing so the bottom-left report action remains separate. Local development disables the Next.js indicator that otherwise covers the report button.


Rough outlines retain the same normalized shape geometry as clean strokes: polygon vertices and line endpoints are anchored, corner arcs use equal radii, and both deterministic stroke passes close at the same seam. Subtle edge variation scales down on tiny shapes; pencil smoothing remains independent. Raster and SVG exports share renderer geometry.

RoomChat is the shared conversation UI for CollaborationPanel and Classroom. A room Chat action opens the native collaboration dialog and focuses its composer. Classroom’s visible Chat toggle exposes the same conversation near the top of its nonmodal panel, before or during a call; microphone/camera permissions are unnecessary for text chat. Both views keep drafts while hidden, show connection/error states, and use a bounded scrollable message log. Plain text only, with sender name and time. RoomSession owns synchronization and retains the last 100 messages until the room expires; messages are excluded from drawing history and portable board files. Chat controls retain existing charcoal surfaces and blue accents.


Free-text selection follows measured visible glyphs, including italic overhangs, underline, line alignment and rich-text markers. It excludes unused stored width/height and trailing blank lines. Logical alignment boxes stay unchanged so older text keeps its visible position. Measurement removes the old two-character minimum and hidden 12-unit margin. A 2-unit selection inset protects the glyph edge; connection ports remain 8 units outside content. Cards keep their intentional container padding. Font completion invalidates text-bound caches and realigns text connectors.
