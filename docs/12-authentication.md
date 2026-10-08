# 12 · Authentication

The backend issues the tokens. The frontend stores them in a cookie and checks them in three layers, from optional to required:

| Layer | Where | Purpose | Is it enough on its own? |
|---|---|---|---|
| 1. Proxy | `src/proxy.ts` | Quick redirect when there's no session cookie | **No.** It only checks that the cookie exists |
| 2. Pages & layouts | `requireUser()` | Redirect to login; get the user to render | Protects the **page** |
| 3. Actions & route handlers | `requireUser()` + `can()` | Real access control | **Required.** Every action checks |

The backend still checks every request it receives. The frontend checks exist to give users a good experience and to block requests early. They don't replace the backend's own authorization.

## Rules

- **Tokens live in `httpOnly`, `Secure`, `SameSite=Lax` cookies**, which only the login and refresh actions set. Never store tokens in `localStorage`, `sessionStorage`, Zustand, or React state.
- **All session code lives in `src/lib/auth/`** and imports `"server-only"`.
- **`getSession()` is wrapped in React `cache()`**, so a page and its layouts share one session lookup per request.
- **Pages that need a user call `requireUser()`.** It redirects to `/login?next=<path>` if there's no user.
- **Every Server Action and route handler calls `requireUser()` itself.** Never assume the page's check also protects them.
- **Permission checks go through `can(user, permission)`.** Don't compare roles inline (`user.role === "admin"`) in components or actions.
- **Hiding a button isn't access control.** Hide what the user can't use, *and* check again on the server.
- **Validate the `next` redirect parameter.** Only accept relative paths that start with `/` and not `//`. Otherwise anyone can craft a login link that sends users to another site after they sign in.
- **Client components only get a minimal user object** (`id`, `name`, `email`, `avatarUrl`, `permissions`). Never send them tokens or the full user record.

## The auth module

```ts
// src/lib/auth/session.ts
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const SESSION_COOKIE = "session";

export const getAccessToken = async () => (await cookies()).get(SESSION_COOKIE)?.value;

export const getSession = cache(async (): Promise<SessionUser | null> => {
  const token = await getAccessToken();
  if (!token) return null;
  // Verify the token with the backend (e.g. GET /auth/me) and parse with sessionUserSchema
  // …
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  return user;
}

export function can(user: SessionUser, permission: Permission): boolean {
  return user.permissions.includes(permission);
}
```

Define permissions as a union type in `src/types/auth.ts` (`"invoice:create" | "invoice:void" | …`). Don't use magic strings scattered through the code.

## Proxy (optional redirect)

```ts
// src/proxy.ts  (this file was called middleware.ts before Next.js 16)
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password"];

export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("session");
  const isPublic = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!hasSession && !isPublic) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"] };
```

Keep the proxy fast. It runs on every request, so don't call the backend from it.

## Current user on the client

The `(app)` layout loads the user once and provides it to the client:

```tsx
// app/(app)/layout.tsx
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <CurrentUserProvider user={toClientUser(user)}>{children}</CurrentUserProvider>;
}
```

Client components then read it with `useCurrentUser()`. This value is for display only. Authorization happens on the server.

## Login & logout

- Login and logout are Server Actions in `features/auth/actions.ts`. Login sets the cookie and then redirects to the validated `next` path. Logout calls the backend to end the session, deletes the cookie, and redirects to `/login`.
- On login failure, show a generic message ("Email or password is incorrect"). Never tell the user which of the two was wrong, because that tells an attacker which emails are registered.

## Don't

- **Don't rely only on the proxy for protection.** It only checks that a cookie exists, not that it's valid.
- **Don't read cookies or tokens in Client Components.** They can't read them anyway (`httpOnly`), and they shouldn't try.
- **Don't decode a JWT and trust its claims without verifying the signature.**
- **Don't cache pages that depend on the user in a cache shared between users.**

## Related

[09 Server Actions](09-server-actions.md) · [08 Data fetching](08-data-fetching.md) · [05 Server/client boundary](05-server-client-boundary.md)
