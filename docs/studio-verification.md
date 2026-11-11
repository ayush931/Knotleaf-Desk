# Studio workspace verification

Validated locally on macOS with a production Next.js build and isolated headless Chrome profiles.

- Automated suite: 767 passing tests; two PostgreSQL tests skipped without a test database.
- TypeScript, ESLint, webpack production build and strict UI audit passed.
- Server smoke: local mode, home/assets, durable room creation, two-client sync, classroom signaling, and persistence after restart passed.
- Live canvas: created document cards, connected both arrow endpoints at the painted borders, saved selected-word Sora formatting, replaced it through a whole-object Inter change, and applied Iris to the workspace.
- Live notes: selected only “clearer” in a paragraph and applied Newsreader; surrounding text retained its font.
- Desktop and 390px viewport: inspected canvas, themes, notes and presentation; verified no document-width overflow and no drawing-tray/zoom overlap.
- Regression coverage includes card border/selection/anchor equality, connection movement and undo, overlapping-card target precedence, selected-text formatting, and whole-object override replacement.
- Fixed issues found during review: wrapped sign-in label, low-contrast light-mode Present action, oversized theme-picker layout, stale font overrides, and connectors choosing an obscured overlapping card.

Limits: these browser checks ran in Chrome, not physical Safari or touch hardware. External Google sign-in and OS notification delivery were not exercised. Database-dependent integration cases require a configured PostgreSQL test database. The tests establish the covered workflows; they do not establish absence of every possible defect.
