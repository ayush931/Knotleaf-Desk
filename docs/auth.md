# Account authentication

Accounts are optional. Personal boards, notes, uploaded files and workspaces remain browser-local and are not scoped to the signed-in account. Room invites and moderator capabilities retain their existing permissions. Signing out does not remove local work.

## Setup

Use Node.js 24 (the existing Docker runtime). `bun dev` starts the Node server. Development without `DATABASE_URL` creates a private `.auth-data/` SQLite database and signing secret, excluded from Git. Keep that directory to retain local accounts and sessions. `AUTH_DATA_DIR` can select another private directory. Local room mode does not disable account database settings; `bun dev` still clears `DATABASE_URL`, so use `bun run dev:hosted` to test PostgreSQL authentication.

For hosted use, set these server-only variables on the **Next.js frontend**, including Vercel when the room server runs separately:

- `DATABASE_URL`: durable PostgreSQL connection string.
- `BETTER_AUTH_URL`: exact app origin, e.g. `https://desk.example.com` (no trailing slash).
- `BETTER_AUTH_SECRET`: random secret of at least 32 characters; generate with `openssl rand -base64 48`. Keep it stable across restarts and instances.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: OAuth Web application credentials from Google Cloud Console.

Vercel uses `bun run build:vercel`, which validates the account environment and runs migrations before the Next build. For other hosts, run `bun run auth:migrate` with the same environment before starting the deployment. This idempotently creates Better Auth's namespaced user, account, session, verification and rate-limit tables; it does not modify room tables. Runtime PostgreSQL requests do not run migrations. Hosted auth fails closed if the database, HTTPS origin or secret is missing; local drawing remains available.

Register `${BETTER_AUTH_URL}/api/auth/callback/google` as an authorized redirect URI in Google Cloud Console. For development, use `http://localhost:3000/api/auth/callback/google` and `BETTER_AUTH_URL=http://localhost:3000`. The app uses the exact configured origin for every OAuth callback. The integrated Node server redirects local loopback page visits to `BETTER_AUTH_URL`, so `127.0.0.1` cannot silently change the Google callback or split session cookies. Open the app at that configured origin. Google sign-in is disabled with an explanation when either credential is missing. Never put these credentials in `NEXT_PUBLIC_*` variables. Google consent/testing access must be configured in the Google project.

## HTTP contract

Better Auth owns `/api/auth/*`. Responses are not cached. Same-origin cookies establish sessions; clients must use the configured origin. Mutations require the trusted origin. OAuth uses the library's state and PKCE validation. The React client owns session refresh and cross-tab sign-out updates.

| Method and path | Input / result |
| --- | --- |
| GET `/api/auth/config` | Public `{enabled, google}` flags only; never secrets. |
| POST `/api/auth/sign-up/email` | JSON `{name,email,password}`. Creates an account and session; password length 12–128 characters. |
| POST `/api/auth/sign-in/email` | JSON `{email,password}`. Creates a session or returns a generic credentials error. |
| POST `/api/auth/sign-in/social` | JSON `{provider:"google",callbackURL,errorCallbackURL,disableRedirect:true}`. Returns the Google authorization URL; navigation starts only on a button click. Return URLs must be trusted. |
| GET `/api/auth/callback/google` | OAuth callback, validated by Better Auth. Returns to the original board route; failure returns an app-owned generic error. |
| GET `/api/auth/get-session` | Public user/session data for the cookie, or `null` without a valid session. No password hash or provider tokens. |
| POST `/api/auth/sign-out` | Revokes the current session and clears its cookie. |

Passwords use Better Auth's salted scrypt hashing. Sessions last seven days, renew after one day, use HttpOnly SameSite cookies, and use Secure cookies on HTTPS. Database-backed throttling allows five email sign-in / social sign-in attempts and three signups per minute per client IP; the general ceiling is sixty requests per minute. Proxy infrastructure must provide trustworthy client IP headers and strip spoofed incoming values. This is supplemental abuse protection, not an account lockout policy.

Email/password accounts do not claim email ownership: email delivery, verification and password recovery are not configured. Google accounts and password accounts are not automatically linked by matching email; use the original sign-in method. No account-based board permissions, synchronization or account management is introduced.

References: [Better Auth setup](https://better-auth.com/docs/installation), [Google provider](https://better-auth.com/docs/authentication/google), [database migrations](https://better-auth.com/docs/concepts/database).

## Google redirect URI mismatch

For the current local defaults, add exactly `http://localhost:3000/api/auth/callback/google` under **Authorized redirect URIs** on the **Web application** OAuth client matching `GOOGLE_CLIENT_ID`. Adding only `http://localhost:3000` under JavaScript origins is insufficient. The scheme, host, port, path and trailing slash must match. Restart the app after changing `.env`. For a deployed domain, set `BETTER_AUTH_URL` to its HTTPS origin and register that origin plus `/api/auth/callback/google` on the same client. Google Cloud settings cannot be changed by editing `.env`.

## Production runtime boundary

Next.js auth routes import only the PostgreSQL backend and shared options. `server/auth-local.mjs` owns SQLite, directory creation and local secrets; only the integrated development server and local test/migration scripts load it. The dev server registers its local factory in the Node process. Hosted routes never fall back to local disk when the database is unavailable.

Initialization failures return HTTP 503 with a safe `code` and `requestId`. Match that ID in Vercel function logs. Codes distinguish configuration, database connection and schema errors; raw exceptions, connection URLs and credentials are never returned or logged by the route wrapper.
