// Same strings as the backend's src/common/types/auth.ts.
export const PERMISSIONS = [
  "user:read",
  "user:manage",
  "audit:read",
  "attendance:self",
  "attendance:read_team",
  "attendance:read_all",
  "correction:submit",
  "correction:decide_team",
  "correction:decide_all",
  "report:read_team",
  "report:read_all",
  "employee:manage",
  "division:manage",
  "policy:manage",
  "holiday:manage",
  "verification:manage",
  "verification:read_photo",
] as const;
export type Permission = (typeof PERMISSIONS)[number];
