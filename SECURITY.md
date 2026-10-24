# Security

Please do not publish sensitive exploit details in a public issue. Use the repository's private vulnerability reporting feature when enabled; otherwise ask the maintainer to enable a private channel without including the exploit.

Boards and notes are stored in localStorage and are not encrypted. Browser data clearing can remove them; export JSON backups. Workspaces provide organization, not security boundaries or account permissions.

Markdown preview renders no raw HTML. SVG export keeps only supported vector elements and attributes from imported icons. Online icon search contacts Iconify when explicitly used. Personal boards do not sync remotely. Shared rooms use the configured WebSocket server; room invite UUIDs grant edit access. Optional Google and email/password accounts use Better Auth with server-side sessions. Accounts do not gate or encrypt browser-local boards, and room access continues to use invite and host capabilities. Email/password addresses are not verified; automatic linking to Google accounts is disabled. Use TLS, an origin allowlist and an authentication gateway to restrict private deployments. See [account setup](docs/auth.md). No telemetry is built in.

Treat JSON and icon imports as untrusted input. Include the app version, OS and minimal reproduction when reporting a vulnerability privately.
