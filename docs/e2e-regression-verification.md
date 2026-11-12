# End-to-end regression verification

Tested the merged workspace in an isolated checkout with a production build, then fixed and retested the issues below.

## Issues reproduced and fixed

- Canvas Enter lost its newline in the contenteditable editor: Chrome produced `FirstSecond` after typing First, Enter, Second. Explicit text insertion now preserves the line break. Shift+Enter, replacing a selection with a newline, trailing blank lines and mobile `beforeinput` breaks are covered.
- Empty hyphen/asterisk list items did not exit on Enter. They now follow the existing bullet-list exit behavior.
- Replacing formatted text inherited the preceding unformatted character. Replacement text now inherits the selected text's appearance.
- Each continued keystroke added a separate equal formatting range. Adjacent matching ranges now coalesce, avoiding unnecessary growth.
- Empty-editor hints now render for contenteditable text, including its trailing caret placeholder.

## Verification

- `bun test`: **773 passed**, **2 skipped** (PostgreSQL integration cases require a configured test database).
- `bun run typecheck`, `bun run lint`, `bun run build --webpack`: passed.
- `bun run test:server`: passed local mode, home/assets, durable room creation, two-client synchronization, classroom signaling and persistence after server restart.
- Strict UI audit: no findings.
- Chrome production-build checks: document-card connections at their borders; selected-word and whole-object font changes; theme application; desktop and 390px layout without horizontal overflow; Notes selected-word font changes; presentation entry/exit controls; Enter and Command+Enter save; formatted replacement followed by 40 keystrokes retaining one range; SVG download retaining Sora formatting.

The new automated regressions cover plain text, document cards, sticky notes, Shift+Enter, mobile line breaks, empty-list exit, formatting inheritance and range growth.

## Verification limits

Live checks ran in Chrome on macOS. Physical Safari/touch hardware, external Google sign-in, OS notification delivery, and the two PostgreSQL cases were not exercised. The recorded results establish the tested workflows, not the absence of every possible defect.

## Follow-up verification: inline history and navigation

A second production-build pass reproduced two additional failures: Command+Z did not undo while editing canvas text, and refreshing the page discarded the active text draft. Inline text editing now keeps a bounded undo/redo history (including formatting and the prior character selection), routes toolbar and native undo commands through that history, and commits active drafts on `beforeunload`/`pagehide`.

- `bun test`: **779 passed**, **2 skipped** (PostgreSQL integration cases require a configured test database).
- Typecheck, lint, production build, local server checks and strict UI audit passed again.
- Chrome verified Command+Z/Command+Shift+Z, toolbar undo/redo, selected-format restoration, redo invalidation after new typing, and draft preservation after an actual reload.
- Editable `.knotleaf` export/import retained all six board elements and notes; the browser reported no runtime errors.
- Document connections, selected and whole-object font changes, theme application, Notes formatting, presentation entry/exit, responsive layout and SVG export were rechecked.

The same physical Safari/touch, external Google sign-in, OS notification and PostgreSQL limits listed above apply to this follow-up.


## Workspace UI handoff verification

The unfinished local UI draft was reconciled with the merged text-editing and Appearance fixes. The completed revision adds native-modal quick actions, a keyboard-operable minimap, selection quick actions, recent drawing colors, explicit color/background presets, two additional Canvas/Notes themes, an empty-canvas starter and saved Straight/Curved line choices. Review fixes address modal focus/clear/IME handling, keyboard scope, selected-character color priority, per-tool color persistence, thin-stroke map bounds, viewport-constrained controls and light-mode contrast. Canvas colors remain consistent with exports without decorative overlays.

- `bun test`: **800 passed**, **2 PostgreSQL-dependent skipped**, across 57 files.
- Typecheck, lint, production build and `test:server`: passed.
- Strict UI audit: no findings. DESIGN.md lint: zero errors; three orphan-token warnings remain in the existing documentation schema.
- Chrome production-build checks at 1440px and 390px: quick-action modal focus/Escape/restore, Tab containment, empty search and Clear, keyboard execution, selection color/duplicate/undo, keyboard minimap pan/center, selected-word quick color, curved-line creation, saved route/geometry after reload, Aurora Dark/Light, Citrus Light, compact swatches and responsive dialog/close controls. No browser runtime errors or horizontal document overflow.

The existing external authentication, OS notification, physical Safari/touch and PostgreSQL verification limits still apply.

## Appearance simplification and formatting verification

Removed the six added font families (Geist, Sora, Bricolage Grotesque, Newsreader, Handlee and IBM Plex Sans) from selectors and bundles, leaving 31 shared families. Presentation defaults use retained fonts. Removed the floating object-selection color/action toolbar. Appearance now has a visible labeled trigger, a clearer panel border/header and larger labeled formatting controls.

Formatting states now summarize the entire selected passage or object group, including gaps and explicit false overrides. Mixed formatting is exposed through `aria-pressed="mixed"`; one click applies the mark throughout the selection. Group formatting no longer adds an empty extra history entry. SVG-icon clicks preserve the active text selection.

- `bun test`: **807 passed**, **2 PostgreSQL-dependent skipped**.
- Typecheck, lint, production build and strict UI audit: passed.
- DESIGN.md lint: zero errors, three existing orphan-token warnings.
- Chrome at 1440px and 390px: all four marks toggle visibly on selected characters, selected text and focus survive icon clicks, mixed selection toggles correctly, whole-object formatting undoes in one step, the font picker has 31 choices, no floating selection toolbar appears, and Appearance remains legible and within the viewport in Dark/Light. No runtime errors or horizontal overflow.

The previously documented external-service and physical-device verification limits remain.

## Draggable Appearance verification

The Appearance trigger now supports immediate pointer dragging, saved canvas-relative coordinates, keyboard movement/reset and viewport clamping. Clicking still opens the inspector near the trigger. Cancellation restores the prior position, and dragging preserves character selection.

- `bun test`: **812 passed**, **2 PostgreSQL-dependent skipped**. Typecheck, lint, production build and strict UI audit passed.
- Component regressions cover drag/click distinction, reload/remount, cancellation/blur/Escape, resize, keyboard/reset and malformed preferences.
- Chrome checked actual mouse and emulated touch dragging, reload persistence, click-to-open, viewport/panel clamping, keyboard movement/reset and selected-text formatting after a drag. No runtime errors.
- Single-shape stroke, fill, width, corners and opacity checks preserve every unselected object; dragging the trigger preserves all artwork. Live browser checks also confirmed independent shape colors/fills.

Physical touch hardware and Safari remain outside the browser coverage recorded here.

## Clay theme verification

Clay adds warm paper and terracotta in Light, and soft charcoal with muted terracotta in Dark. It uses the shared theme registry, scope controls, persisted preferences, gallery, quick actions, Canvas and Notes tokens.

- `bun test`: **819 passed**, **2 PostgreSQL-dependent skipped**. Typecheck, lint, production build and strict UI audit passed.
- Contrast checks cover body/muted text, primary actions and selected controls in both modes.
- Chrome verified Canvas/Notes in Light and Dark, reload persistence, Notes-only scope, preserved custom canvas backgrounds when replacement is unchecked, unchanged custom artwork/geometry and a 390px theme gallery. No runtime errors.

## Appearance top-edge follow-up

Removed the toolbar-height minimum from the saved trigger and inspector positions. The default/reset position remains below the toolbar, while dragging and keyboard movement can now reach the canvas's exact top edge (`y: 0`).

- `bun test`: **820 passed**, **2 PostgreSQL-dependent skipped**; typecheck, lint, production build and strict UI audit passed.
- Chrome verified immediate movement to `y: 0`, a clickable trigger beside the toolbar, panel positioning, no accidental open after dragging and persistence after reload. No runtime errors.

## Readable arrow-label verification

Arrow labels now use larger 16px/600 text, solid contrast plates, multiline wrapping and a shared measured box for painting, editing, hit detection and export bounds. Appearance and direct editing share the same draft. The bend handle sits outside the label and preserves its original drag behavior without a jump. Repeated measurements are cached and invalidated when fonts load.

- `bun test`: **829 passed**, **2 PostgreSQL-dependent skipped**, across 58 files. Typecheck, lint, production build and strict UI audit passed.
- Regressions cover long tokens/multiline layout, contrast plates, label-inclusive bounds, offset handles across zoom levels, bend/cancel/undo/redo, editing, no style leakage into plain text, independent labels, SVG and editable diagram export, and measurement reuse.
- Chrome verified straight, curved and elbow labels in both modes; centered edit geometry; lower-line selection; synchronized Appearance edits; independent labels; offset bend dragging and undo; an actual SVG download retaining typography/content; and reload persistence. No runtime errors.

Previously documented physical-device and external-service verification limits remain.

## Text input and font-control follow-up

Reproduced native multiline insertion flattening `First\nSecond` into `FirstSecond`. RangeTextEditor now reads native block/BR boundaries as newlines, normalizes multiline insertion and paste, and distinguishes its caret placeholder. Enter/Tab transactions are shared by hardware and software input, apply immediately without deferred caret movement, and preserve independent formatting across selected-line indentation. Composition text survives styling rerenders, composing Enter is ignored, blur flushes it before commit, and non-cancelable events are normalized without double insertion. Empty-editor selection restoration places the caret before its break.

Removed the quick font-button grid; the single grouped font dropdown retains all 31 choices. Double-clicking an unlabeled arrow now opens its label editor directly.

- `bun test`: **842 passed**, **2 PostgreSQL-dependent skipped**, across 59 files. Typecheck, lint, production build and strict UI audit passed. DESIGN.md lint had zero errors and three existing orphan-token warnings.
- New regressions cover DOM newline normalization/caret offsets, native replacement, list continuation/exit, Shift+Enter, rapid input, selected-line indent/outdent with rich marks, composition rerenders/blur, non-cancelable input, empty caret placement and blank-arrow editing.
- Chrome on macOS verified native multiline insertion, Enter/Delete/undo/redo in plain text/document/sticky editors, unchanged sibling objects, Option+Backspace, rapid lists, software Enter, composition commit/undo/redo, the dropdown-only font UI with selected-text priority, initial arrow-label typing and reload persistence. No runtime errors.

Safari/physical touch and the previously documented external-service cases were not exercised in this pass.

## Free-text wrapping consistency

Reproduced in Chrome on macOS: `A longer sentence with several words and additional content` displayed on two visual lines despite containing no newline; `First\nSecond`-style two-line content could gain a third visual line. The contenteditable wrapper discarded its caller's `wrap="off"` and always used `pre-wrap`. It now honors explicit-line-only editing for free canvas text, including empty drafts and reopening. Bounded text boxes, document cards, sticky notes and arrow labels continue soft wrapping.

- `bun test`: **845 passed**, **2 PostgreSQL-dependent skipped**, across 59 files. Lint, typecheck, webpack production build and strict UI audit passed.
- Real Chrome on macOS verified the original sentence stays on one visual line, explicit Enter produces exactly two lines, reduced/normal/enlarged zoom, rapid word input, five font families, mid-line replacement, undo/redo, wrapping in every bounded surface, and exact saved element data after reload. No browser runtime errors.
- Component regressions cover the empty/free/reopened editor wrapping policy, explicit newline persistence, text-box wrapping and sticky-note wrapping. Safari and physical mobile devices were not exercised in this pass.

The visual pass also exposed document cards wrapping in the editor but expanding to a single long line after commit. Document rendering, measurement, editing bounds and resizing now share bounded card widths, including legacy cards without textBox. New cards begin at 240×100 and grow vertically. Engine regressions cover legacy/new cards and saved/reopened width; Chrome confirmed long document text retains its 240-unit width through save/reload.

## Knotleaf Sketch custom whiteboard font

Added a self-hosted OFL derivative of Shantell Sans with restrained informality, bounce and spacing. Fixed alternates and disabled contextual randomization keep glyph choice stable between contenteditable runs and per-character canvas styling. Both normal and true italic WOFF2 files retain the full upstream 837-codepoint coverage and a 400–700 weight axis. Rebuilding uses pinned source revisions/checksums; attribution/license accompany the assets.

- `bun test`: **845 passed**, **2 PostgreSQL-dependent skipped**; lint, typecheck, webpack production build and strict UI audit passed.
- FontTools inspection verified both generated family names, weight axes, complete Unicode coverage and absence of contextual randomization.
- Chrome on macOS loaded all six normal/italic 400/500/700 requests using the actual local faces. Checked fresh Sketch defaults, free-text wrapping/Enter, bold/italic, selected-range Caveat compatibility, all 32 font choices, save/reload and narrow workspace rendering. No runtime errors.
- Inspected the rendered font at 16/20/24/30/52px on light/dark surfaces; specimen: [Knotleaf Sketch](assets/knotleaf-sketch.png). Existing saved font IDs and persisted device font choices are retained. Safari/physical touch and live collaboration were not exercised in this pass.

## Final-character clipping in Knotleaf Sketch

Reproduced real DOM text widths exceeding the canvas-sized editing box: `Testing the last character` measured 225.69px in the editor versus its 221px box, and a longer sentence measured 530.23px versus 524px. Canvas kerning differed from the editor, and hidden overflow cut off the right edge. Shared setFont now disables kerning consistently; generic editors allow glyph overhangs on both axes without changing alignment padding or coordinates. The same cases now fit inside 226px and 531px boxes with no caret scrolling.

- 845 automated tests passed; 2 PostgreSQL-dependent tests skipped. Lint, typecheck, webpack production build and strict UI audit passed.
- Chrome on macOS verified the reproduced sentences, all 32 font choices, three zoom levels, rapid typing, explicit multiline input, Enter/Shift+Enter, deletion, Option+Backspace, undo/redo, lists, software Enter, IME composition, selected-range fonts, independent objects, document/sticky/text-box wrapping, arrow labels and save/reload. No runtime errors.
- Updated the anchored-editor regression to require visible overflow on both axes, retaining zero scroll offsets and unchanged alignment coordinates. Safari/physical touch were not tested in this pass.
