"use client";

import type { NavAccess } from "@/config/nav";
import { useCurrentUser } from "@/features/auth/components/current-user-provider";
import { useMeContext } from "@/features/profile/components/me-context-provider";

/** Who sees which nav entries: permissions plus whether the user has an employee profile. */
export function useNavAccess(): NavAccess {
  const { permissions } = useCurrentUser();
  const { employee } = useMeContext();
  return { permissions, hasEmployeeProfile: employee !== null };
}
