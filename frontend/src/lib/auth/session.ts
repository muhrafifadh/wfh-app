import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { sessionUserSchema, type SessionUser } from "@/features/auth/schemas";
import { apiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { getAccessToken } from "@/lib/auth/cookies";
import type { Permission } from "@/types/auth";

export type { SessionUser };

/**
 * The signed-in user, or null. Validated by the backend on every request and
 * deduplicated per render with cache(). Reads cookies, so with Cache Components
 * the caller must sit inside a <Suspense> boundary.
 */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  if (!(await getAccessToken())) return null;
  try {
    return await apiFetch("/auth/me", { schema: sessionUserSchema });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
});

/** For pages, layouts and Server Actions that need a user. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  // The route handler clears stale cookies before showing the login page,
  // so a revoked session can't bounce between here and proxy.ts.
  if (!user) redirect("/auth/session-expired");
  return user;
}

export function can(user: Pick<SessionUser, "permissions">, permission: Permission): boolean {
  return user.permissions.includes(permission);
}

/** For routes any one of several permissions opens (e.g. team or organization scope). */
export function canAny(
  user: Pick<SessionUser, "permissions">,
  permissions: readonly Permission[],
): boolean {
  return permissions.some((permission) => user.permissions.includes(permission));
}
