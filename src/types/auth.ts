// Same strings as the backend's src/common/types/auth.ts.
export const PERMISSIONS = ["user:read", "user:manage"] as const;
export type Permission = (typeof PERMISSIONS)[number];
