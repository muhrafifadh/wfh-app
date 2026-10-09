"use client";

import { useCurrentUser } from "@/features/auth/components/current-user-provider";

/** Example client component reading the user without prop drilling. */
export function UserGreeting() {
  const user = useCurrentUser();
  return <p className="text-muted-foreground">Signed in as {user.email}</p>;
}
