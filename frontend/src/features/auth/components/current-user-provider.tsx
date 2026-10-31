"use client";

import { createContext, use } from "react";

import type { SessionUser } from "@/features/auth/schemas";

const CurrentUserContext = createContext<SessionUser | null>(null);

/** Rendered once by the (app) layout after requireUser(). Display only: authorization happens on the server. */
export function CurrentUserProvider({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  return <CurrentUserContext value={user}>{children}</CurrentUserContext>;
}

export function useCurrentUser(): SessionUser {
  const user = use(CurrentUserContext);
  if (!user) throw new Error("useCurrentUser() must be used inside the (app) layout.");
  return user;
}
