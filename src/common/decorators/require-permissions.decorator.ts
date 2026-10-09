import { SetMetadata } from "@nestjs/common";

import type { Permission } from "@/common/types/auth.js";

export const PERMISSIONS_KEY = "permissions";

/** Caller must be signed in and hold every listed permission. */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
