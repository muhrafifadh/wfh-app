# 12 · Authentication

The backend issues a short-lived access token (15 min) and a rotating refresh token (30 days, sliding). The frontend keeps both in httpOnly cookies and checks them in three layers, from optional to required:

| Layer                       | Where                     | Purpose                                               | Is it enough on its own?                  |
| --------------------------- | ------------------------- | ----------------------------------------------------- | ----------------------------------------- |
| 1. Proxy                    | `src/proxy.ts`            | Refreshes tokens; redirects when there are no cookies | **No.** It only checks that cookies exist |
| 2. Pages & layouts          | `requireUser()`           | Redirect to login; get the user to render             | Protects the **page**                     |
| 3. Actions & route handlers | `requireUser()` + `can()` | Real access control                                   | **Required.** Every action checks         |

The backend still checks every request it receives. The frontend checks exist to give users a good experience and to block requests early. They don't replace the backend's own authorization.

## Rules

- **Tokens live in two `httpOnly`, `SameSite=Lax` cookies** (`access_token`, `refresh_token`; `Secure` in production), set only by `loginAction` and `proxy.ts`. The access cookie expires 30 s before the token does, so its absence means "refresh now". Never store tokens in `localStorage`, `sessionStorage`, Zustand, or React state.
- **All session code lives in `src/lib/auth/`** and imports `"server-only"`.
- **`getSession()` is wrapped in React `cache()`**, so a page and its layouts share one session lookup per request.
- **Pages that need a user call `requireUser()`.** If the backend rejects the session (revoked, user disabled), it redirects to `/auth/session-expired`, a route handler that clears the stale cookies and then shows `/login`. That stops a redirect loop between the page and the proxy.
- **With Cache Components, reading the session must happen inside `<Suspense>`.** The `(app)` layout puts the whole signed-in area behind one boundary. Never `await requireUser()` at the top level of a layout outside a boundary: the build fails.
- **Every Server Action and route handler calls `requireUser()` itself.** Never assume the page's check also protects them.
- **Permission checks go through `can(user, permission)`.** Don't compare roles inline (`user.role === "admin"`) in components or actions.
- **Hiding a button isn't access control.** Hide what the user can't use, _and_ check again on the server.
- **Validate the `next` redirect parameter** with `safeRedirectPath()` (`lib/auth/redirect.ts`). Only relative paths that start with `/` (not `//` or `/\`) are accepted. Otherwise anyone can craft a login link that sends users to another site after they sign in.
- **Client components only get a minimal user object** (`id`, `name`, `email`, `organizationId`, `permissions`). Never send them tokens or the full user record.

## The auth module

| File                   | Job                                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| `lib/auth/cookies.ts`  | Cookie names and options; `getAccessToken`, `setTokenCookies`, `clearTokenCookies`                 |
| `lib/auth/session.ts`  | `getSession()` (`GET /auth/me`, cached per request), `requireUser()`, `can()`                      |
| `lib/auth/refresh.ts`  | `refreshTokens()`, used by `proxy.ts`                                                              |
| `lib/auth/redirect.ts` | `safeRedirectPath()`                                                                               |
| `lib/api/client.ts`    | `apiFetch()`: adds the bearer token, parses responses, throws `ApiError` with the backend's `code` |

```ts
// src/lib/auth/session.ts
export const getSession = cache(async (): Promise<SessionUser | null> => {
  if (!(await getAccessToken())) return null;
  try {
    return await apiFetch("/auth/me", { schema: sessionUserSchema });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/auth/session-expired");
  return user;
}
```

Define permissions as a union type in `src/types/auth.ts` (`"invoice:create" | "invoice:void" | …`). Don't use magic strings scattered through the code.

## Proxy: refresh and redirect

`src/proxy.ts` (called `middleware.ts` before Next.js 16) runs before every page, Server Action and route handler:

1. **Access cookie missing, refresh cookie present:** call `POST /auth/refresh`, then put the new tokens on the request (so the code that runs next sees them) _and_ on the response (so the browser keeps them).
   - Refresh rejected (401): delete both cookies and redirect to `/login?next=…`.
   - Backend unreachable: keep the cookies and let the page show its error state.
2. **No cookies on a protected path:** redirect to `/login?next=…`.
3. **Access cookie on `/login`:** redirect to `/`.

The proxy only calls the backend about once every 15 minutes per user, when the access token runs out. If several requests refresh at the same moment, the backend's 10-second grace window gives each one a valid pair, so the session isn't revoked as "reused".

## Current user on the client

The `(app)` layout loads the user once and provides it to the client:

```tsx
// app/(app)/layout.tsx
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<AppShellSkeleton />}>
      <SignedInShell>{children}</SignedInShell>
    </Suspense>
  );
}

async function SignedInShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <CurrentUserProvider user={user}>
      {/* header + main */}
      {children}
    </CurrentUserProvider>
  );
}
```

Client components then read it with `useCurrentUser()`. This value is for display only. Authorization happens on the server.

## Login & logout

- Login and logout are Server Actions in `features/auth/actions.ts`. Login sets the cookie and then redirects to the validated `next` path. Logout calls the backend to end the session, deletes the cookie, and redirects to `/login`.
- On login failure, show a generic message ("Email or password is incorrect"). Never tell the user which of the two was wrong, because that tells an attacker which emails are registered.

## Don't

- **Don't rely only on the proxy for protection.** It only checks that cookies exist, not that they're valid.
- **Don't refresh tokens anywhere except `proxy.ts`.** Server Components can't set cookies, and a second place that refreshes would race with the first.
- **Don't read cookies or tokens in Client Components.** They can't read them anyway (`httpOnly`), and they shouldn't try.
- **Don't decode a JWT and trust its claims without verifying the signature.**
- **Don't cache pages that depend on the user in a cache shared between users.**

## Related

[09 Server Actions](09-server-actions.md) · [08 Data fetching](08-data-fetching.md) · [05 Server/client boundary](05-server-client-boundary.md)
