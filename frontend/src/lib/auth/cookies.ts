import "server-only";

import { cookies } from "next/headers";

import { env } from "@/lib/env";

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

/** Drop the access cookie a little early so proxy.ts refreshes before the backend rejects it. */
const ACCESS_EXPIRY_MARGIN_MS = 30_000;

export type TokenPair = {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
};

type CookieToSet = {
  name: string;
  value: string;
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  expires: Date;
};

/** docs/12-authentication.md — tokens live only in httpOnly cookies. */
export function tokenCookies(tokens: TokenPair): CookieToSet[] {
  const base = {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  } as const;
  const accessExpires = new Date(
    new Date(tokens.accessTokenExpiresAt).getTime() - ACCESS_EXPIRY_MARGIN_MS,
  );
  return [
    { ...base, name: ACCESS_COOKIE, value: tokens.accessToken, expires: accessExpires },
    {
      ...base,
      name: REFRESH_COOKIE,
      value: tokens.refreshToken,
      expires: new Date(tokens.refreshTokenExpiresAt),
    },
  ];
}

export async function getAccessToken(): Promise<string | undefined> {
  return (await cookies()).get(ACCESS_COOKIE)?.value;
}

export async function setTokenCookies(tokens: TokenPair): Promise<void> {
  const store = await cookies();
  for (const cookie of tokenCookies(tokens)) store.set(cookie);
}

export async function clearTokenCookies(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}
