feat(auth): add login, session and token refresh

> **Stacked on the scaffold PR (`chore/scaffold`).** Merge that first. This PR's base is `chore/scaffold`, so the diff shows auth changes only. It needs the backend auth PR (`backend-boilerplate`, `feat/auth`).

> [!WARNING]
> **Known issue: the login rate limit is shared by all users.**
> `loginAction` calls the backend from the Next.js server, so the backend's limit of 5 attempts/minute per IP applies to the **Next server's IP, shared by every user**. In production, 5 failed logins from anyone would block login for everyone for a minute.
> **Follow-up before production:** forward the client IP (`X-Forwarded-For`) from `loginAction`. The backend side of the fix is described in the backend auth PR.

## What

- **`lib/api/client.ts`** (`apiFetch`):
  - The only way to call the backend: server-only, with a 10 s timeout.
  - Adds the bearer token, parses responses with Zod.
  - Throws `ApiError` with the backend's `code`, `details` and `requestId`.
- **`lib/auth/`:**
  - **Cookies:** two httpOnly, `SameSite=Lax` cookies (`Secure` in production). The access cookie expires 30 s before the token does.
  - **`getSession()`:** calls `GET /auth/me`, cached once per request with React `cache()`.
  - **`requireUser()` and `can()`.**
  - **`refreshTokens()`.**
  - **`safeRedirectPath()`:** blocks open redirects.
- **`src/proxy.ts`:**
  - If only the refresh cookie is left, it refreshes the tokens and sets them on both the request and the response, so the page sees them in the same request.
  - Clears cookies when the refresh is rejected.
  - Keeps cookies if the backend is unreachable.
  - Redirects with `?next=` on protected paths.
- **`/auth/session-expired`:** a route handler that clears stale cookies when the backend rejects a session. This prevents a redirect loop between the page and the proxy.
- **Login:** `/login` uses React Hook Form, Zod, and shadcn `field`. `loginAction` validates on the server, maps backend errors (`INVALID_CREDENTIALS`, 429, field errors), sets cookies, and redirects to a safe `next`.
- **Sign out:** `logoutAction` revokes the session on the backend, clears cookies, and redirects to `/login`.
- **`(app)` group:** the signed-in shell (header with name and sign-out) behind one `<Suspense>`, plus `CurrentUserProvider` and `useCurrentUser()`. The home page shows the user and their permissions.
- **Permissions:** `src/types/auth.ts` has the same strings as the backend. Permissions the frontend doesn't know are dropped instead of breaking the session.
- **Docs:** `docs/12-authentication.md` rewritten to match.

## Next.js 16.4 notes

- **Cache Components:** reading the session must happen inside `<Suspense>`, or the build fails. The whole signed-in area streams behind one boundary in `(app)/layout.tsx`. The build shows `/` as partially prerendered and `/login` as static.
- **shadcn changed:** it no longer ships `form`, so the login form wires React Hook Form to `field` with `Controller`.

## Checks (all passing locally)

| Check | Result |
|---|---|
| `pnpm lint` / `pnpm typecheck` / `pnpm format:check` | ✅ |
| `pnpm test` | ✅ 14 tests: `safeRedirectPath` accepts relative paths and rejects `//`, `/\`, absolute URLs, `javascript:` and control characters |
| `pnpm build` | ✅ |

**Run end to end against the backend auth branch** (both production builds, real browser):

- `/` and `/settings?x=1` without cookies → 307 to `/login`, with `?next=` kept.
- Wrong password → "Email or password is incorrect." shown.
- Correct seed credentials → home page with the name, `useCurrentUser()` greeting, and permissions.
- A request carrying only the refresh cookie → `proxy.ts` refreshes, the page renders signed in, and both new cookies are set (`HttpOnly; Secure; SameSite=lax`).
- Sign out → backend `204`, cookies cleared, `/` redirects to `/login` again.

## Follow-ups

- **Login rate limit** (see the warning at the top).
- **Playwright e2e** for sign in, sign out, and the protected-route redirect, with axe checks (part of the CI follow-up).
- **Register and password reset pages,** once the backend endpoints exist.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
