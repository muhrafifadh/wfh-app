import "server-only";

import { tokenPairSchema } from "@/features/auth/schemas";
import type { TokenPair } from "@/lib/auth/cookies";
import { env } from "@/lib/env";

export type RefreshResult =
  | { status: "ok"; tokens: TokenPair }
  | { status: "rejected" } // refresh token invalid, expired, revoked or reused
  | { status: "unavailable" }; // backend unreachable: keep cookies, try again later

/** Exchanges a refresh token for a new pair. Used by proxy.ts. */
export async function refreshTokens(refreshToken: string): Promise<RefreshResult> {
  try {
    const res = await fetch(`${env.API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refreshToken }),
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 400) return { status: "rejected" };
    if (!res.ok) return { status: "unavailable" };
    return { status: "ok", tokens: tokenPairSchema.parse(await res.json()) };
  } catch {
    return { status: "unavailable" };
  }
}
