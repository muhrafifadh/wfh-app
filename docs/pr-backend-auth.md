feat(auth): add JWT auth with rotating refresh tokens

> **Stacked on the scaffold PR (`chore/scaffold`).** Merge that first. This PR's base is `chore/scaffold`, so the diff shows auth changes only.

> [!WARNING]
> **Known issue: the login rate limit is shared by all users.**
> Login is limited to 5 attempts/minute per IP. But the frontend calls `/auth/login` from the Next.js server, so the backend sees the **Next server's IP for every user**. In production, 5 failed logins from anyone would block login for everyone for a minute.
> **Follow-up before production:** forward the client IP from the frontend, only trust it from the frontend server, and key the limit by client IP + email (as `docs/08-authentication.md` intends).

## What

- **Schema and first migration:** `organizations`, `roles` (`permissions text[]`), `users`, `sessions`, `refresh_tokens`. UUIDv7 keys, an index on every foreign key, cascade deletes only on sessions and tokens.
- **Endpoints:**
  - `POST /v1/auth/login`
  - `POST /v1/auth/refresh`
  - `POST /v1/auth/logout`
  - `GET /v1/auth/me`
- **Tokens:**
  - Access token: HS256 JWT (`sub`, `sid`), 15 minutes, `iss` and `aud` checked.
  - Refresh token: 32 random bytes, stored only as a SHA-256 hash, valid 30 days and extended on each use.
- **Rotation and reuse detection:**
  - Every refresh issues a new refresh token.
  - A token used twice revokes the whole session (`REFRESH_TOKEN_REUSED`).
  - Exception: a repeat within **10 seconds** counts as two refreshes at once (two tabs, parallel requests), not theft, so it gets a fresh pair instead.
  - The revocation runs outside the transaction, so throwing can't roll it back.
- **Passwords:** Argon2id (`@node-rs/argon2`). Login gives the same error and takes the same time for an unknown email, a wrong password, or a disabled user (checked against a dummy hash).
- **Guards:**
  - Global `JwtAuthGuard` checks the JWT, then that the session is active and the user isn't disabled. So logout and revocation work immediately.
  - Global `PermissionsGuard` enforces `@RequirePermissions(...)`.
- **New `@Authenticated()` decorator** for routes any signed-in user may call (`/me`, `/logout`).
- **`RouteAuthAuditor`:** the app refuses to start if any route lacks `@Public`, `@Authenticated` or `@RequirePermissions`.
- **Dev seed** (`pnpm db:seed`): org "Acme" with an `owner` role (all permissions), a `member` role, and an admin user. The password comes from `SEED_ADMIN_PASSWORD` in your local `.env`. The seed refuses to run in production.
- **Docs updated:** 01, 02, 04, 08, 09, quick reference, `CLAUDE.md`.

## Design changes from the docs (docs updated in this PR)

- **Auth guards live in `modules/auth/guards/`, not `common/guards/`.** They need `AuthService`, and `common/` must not import from `modules/`.
- **Every request checks the session in the database.** The guard already loads the user and permissions, and this makes logout take effect immediately.
- **Permissions are loaded once per request** into `AuthUser.permissions`. There's no cache yet.

## Checks (all passing locally)

| Check | Result |
|---|---|
| `pnpm lint` / `pnpm typecheck` | ✅ |
| `pnpm test` | ✅ 5 unit tests |
| `pnpm test:e2e` (real Postgres) | ✅ **21 tests**, including 14 new auth tests (below) |
| `pnpm build` + `node dist/main.js` | ✅ used by the frontend end-to-end run |
| `pnpm db:seed` twice | ✅ safe to run repeatedly |

The new auth e2e tests cover:

- **Login:** works, case-insensitive email; same error for wrong password, unknown email and disabled user; body validation; 429 after 5 attempts.
- **Access tokens:** missing or malformed token → 401; expired → `TOKEN_EXPIRED`; disabled user is rejected on the next request.
- **Refresh:** rotation; reuse revokes the whole session; parallel refreshes both succeed; unknown token → `INVALID_REFRESH_TOKEN`.
- **Logout:** kills both the access and refresh tokens.
- **Permissions:** 403 without the permission, 200 with it.
- **Startup audit:** the app refuses to start with an undecorated route.

## Secrets

- `.env` (which holds the local seed password) is not committed.
- `.env.example` only gains a placeholder for `SEED_ADMIN_PASSWORD`.

## Follow-ups

- **Login rate limit** (see the warning at the top).
- **Not built yet:** register, logout-all, password reset and email verification (rules already in `docs/08`).
- **Cleanup job** for expired or revoked sessions.
- **Unit tests** for `AuthService`. Currently e2e only.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
