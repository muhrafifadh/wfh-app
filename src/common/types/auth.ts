// docs/09-authorization.md — the single list of permission strings.
// The frontend's can() helper uses the same strings.
export const PERMISSIONS = ["user:read", "user:manage", "audit:read"] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const isPermission = (value: string): value is Permission =>
  (PERMISSIONS as readonly string[]).includes(value);

/** The authenticated caller, attached to the request by JwtAuthGuard. */
export type AuthUser = {
  id: string;
  sessionId: string;
  organizationId: string;
  permissions: readonly Permission[];
};
