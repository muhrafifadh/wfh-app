import { NextResponse, type NextRequest } from "next/server";

import { ACCESS_COOKIE, REFRESH_COOKIE, tokenCookies } from "@/lib/auth/cookies";
import { refreshTokens } from "@/lib/auth/refresh";

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/auth/session-expired",
];

/** Signed-in users don't need these; send them home. */
const GUEST_ONLY_PATHS = ["/login", "/register"];

const isPublicPath = (pathname: string) =>
  PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/**
 * docs/12-authentication.md — runs before every page, Server Action and route handler.
 * 1. Refreshes the access token when only the refresh token is left, so everything
 *    downstream sees a valid access cookie in the same request.
 * 2. Optimistic redirects based on cookie presence. Real checks happen in requireUser().
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublic = isPublicPath(pathname);
  const hasAccess = request.cookies.has(ACCESS_COOKIE);
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (!hasAccess && refreshToken) {
    const result = await refreshTokens(refreshToken, request.headers.get("x-forwarded-for"));

    if (result.status === "ok") {
      const cookies = tokenCookies(result.tokens);
      // Forward the new tokens to this request's server code...
      for (const cookie of cookies) request.cookies.set(cookie.name, cookie.value);
      const response = NextResponse.next({ request: { headers: request.headers } });
      // ...and store them in the browser.
      for (const cookie of cookies) response.cookies.set(cookie);
      return response;
    }

    if (result.status === "rejected") {
      const response = isPublic ? NextResponse.next() : redirectToLogin(request, pathname + search);
      response.cookies.delete(ACCESS_COOKIE);
      response.cookies.delete(REFRESH_COOKIE);
      return response;
    }
    // "unavailable": the backend is down. Keep the cookies; the page shows its error state.
    return NextResponse.next();
  }

  if (!hasAccess && !isPublic) return redirectToLogin(request, pathname + search);
  if (hasAccess && GUEST_ONLY_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

function redirectToLogin(request: NextRequest, next: string) {
  const url = new URL("/login", request.url);
  if (next !== "/") url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except static files, images and metadata files
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.[\\w]+$).*)"],
};
