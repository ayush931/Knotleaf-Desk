# Security

Please do not publish sensitive exploit details in a public issue. Use the repository's private vulnerability reporting feature when enabled; otherwise ask the maintainer to enable a private channel without including the exploit.

Boards and notes are stored in localStorage and are not encrypted. Browser data clearing or uninstalling a desktop profile can remove them; export JSON backups. Browser and Electron storage profiles are separate. Workspaces provide organization, not security boundaries or account permissions.

Markdown preview renders no raw HTML. SVG export keeps only supported vector elements and attributes from imported icons. Desktop renderers are sandboxed with context isolation and no Node integration. The bundled server listens only on loopback. Online icon search contacts Iconify when explicitly used. Personal boards do not sync remotely. Shared rooms use the configured WebSocket server; room invite UUIDs grant edit access. No authentication or role system is included. Use TLS, an origin allowlist and an authentication gateway for private deployments. No telemetry is built in.

Treat JSON and icon imports as untrusted input. Include the app version, OS and minimal reproduction when reporting a vulnerability privately.
