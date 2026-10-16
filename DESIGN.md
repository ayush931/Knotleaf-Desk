---
version: alpha
name: Whiteboard
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

# Whiteboard Design System

## Overview

### Creative North Star
An engineering drawing desk: quiet charcoal chrome, a spacious canvas, and bright blue attachment ports that make diagram structure visible.

### Product context and register
Personal diagrams and project notes, primarily used on desktop with keyboard and pointer. English interface; no market-specific business rules. This is a product tool, not a marketing page. Repository README and current user instructions supply the product context. Preserve the existing dark identity. The connected-node mark is the expressive signature; controls remain familiar. Avoid decorative gradients, giant toolbars, and ornamental cards.

Runtime sources are canonical: `app/globals.css` owns global styles and scrollbar tokens; `app/layout.tsx` owns font variables; shared components own utility-class geometry; `draw/renderer.ts` owns canvas visuals and blue ports. This document records these implemented values, rather than generating a separate theme.

## Colors
Background #121212, surface #18181b, border #27272a, text #f4f4f5, muted #a1a1aa, primary #3b82f6. Blue means active/selected/connected. Rose indicates destructive actions. Use labels and shapes alongside color. Forced-colors scrollbars use system colors.

## Typography
Inter for controls, Fira Code for Markdown source and coordinates, Caveat for hand lettering. Fonts are bundled by Next at build time. Notes use 13px source with 24px line height and 14px rendered prose. Controls remain compact without compromising focus indicators.

## Layout
44px fixed header, drawing tools inset 6px below it. Inspector is relative to the canvas, below the tools; it scrolls internally only when necessary. Notes split starts at 360px, is draggable and keyboard resizable; below 640px it becomes a vertically stacked split. Notes contain their own vertical scroll; long prose and code wrap instead of forcing horizontal scrolling. Toolbars wrap on narrow viewports. The canvas itself pans, never document-scrolls.

## Elevation & Depth
Borders and tonal surfaces establish hierarchy. Shadows are reserved for floating tools, menus and drawers. Modal backdrops darken the workspace. Avoid shadows on document content.

## Shapes
8px controls, 12px floating panels. Lucide icons use consistent strokes. The blue/white node mark is shared by header, favicon, PWA and desktop packages.

## Components
Native buttons for actions. Active view buttons expose aria-pressed. Workspace and export quality selects deliberately use platform-owned native popups. Native dialog owns modal focus, Escape and background inertness. Inline board-deletion confirmation stays inside the workspace dialog and states the consequence. Enabled buttons have hover/pointer/focus states; disabled actions are muted. No browser confirm/alert flows.

Notes toolbar, outline, source editor and GFM preview share one owner in `DocEditor`. Renderer and engine share the same connector geometry for hit testing, labels, selection and exports. Endpoint handles reconnect; connector-body movement preserves attachments. `BoardsSidebar` owns local workspace navigation.

Motion is brief functional feedback. Reduced-motion styles disable decorative animation. The app avoids skeletons and unstable placeholders. Plain labels name actions and outcomes.

## Do's and Don'ts
- Do keep notes and drawings in the same board and make attachment ports visible.
- Do reuse the shared renderer for vector export.
- Don't claim cloud collaboration or successful saving without evidence.
- Don't hide necessary content scrollbars; eliminate horizontal overflow through wrapping.
