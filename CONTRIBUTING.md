# Contributing

Use Node.js 24 and Bun 1.4.3 or newer. Run `bun install`, then `bun dev`.
Before opening a pull request, run `bun run typecheck`, `bun run lint`, `bun test`, and `bun run build`.

Keep changes focused. Explain the problem, resulting behavior, and verification. Add regression tests for geometry, attachments, persistence or interchange changes. Include screenshots for visible UI changes when a browser is available. Read DESIGN.md and UX-CONTRACT.md before changing shared controls or behavior.

Preserve existing local boards. Storage changes need backward compatibility; imports must never overwrite an existing board. A workspace is local organization, not a cloud team. Do not introduce telemetry, remote synchronization or paid dependencies without discussing the product change.

Desktop builds are in desktop/ and electron-builder.yml. Keep context isolation, sandboxing and Node integration disabled in renderers. Test a packaged build on its target OS before calling it a supported release. CI creates unsigned installers; production signing requires maintainer credentials.

The project uses the MIT license. Contributions must be compatible with it; third-party artwork and libraries retain their original licenses. Be respectful, specific, and constructive in issues and reviews.
