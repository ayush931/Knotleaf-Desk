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
