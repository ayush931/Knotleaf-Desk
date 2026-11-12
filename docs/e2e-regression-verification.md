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
