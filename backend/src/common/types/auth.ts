// docs/09-authorization.md — the single list of permission strings.
// The frontend's can() helper uses the same strings.
export const PERMISSIONS = [
  "user:read",
  "user:manage",
  "audit:read",
  // Hadir.in (DATA_MODEL.md §4.2). Data scope (own / direct reports / organization)
  // is still checked in services.
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
  // ATTENDANCE_VERIFICATION_PLAN.md §8 (V9): photo access is held apart from everything else
  "verification:manage",
  "verification:read_photo",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const isPermission = (value: string): value is Permission =>
  (PERMISSIONS as readonly string[]).includes(value);

/**
 * The roles every organization starts with. "owner" holds everything; "member" is
 * the boilerplate's read-only role. Keep in sync with the data migration that
 * added the Hadir.in roles (prisma/migrations/*_add_master_data).
 */
export const DEFAULT_ROLES = {
  owner: [...PERMISSIONS],
  member: ["user:read"],
  admin_hr: [
    "attendance:self",
    "correction:submit",
    "attendance:read_all",
    "correction:decide_all",
    "report:read_all",
    "employee:manage",
    "division:manage",
    "policy:manage",
    "holiday:manage",
    "verification:manage",
    "verification:read_photo",
    "user:read",
    "user:manage",
    "audit:read",
  ],
  manager: [
    "attendance:self",
    "correction:submit",
    "attendance:read_team",
    "correction:decide_team",
    "report:read_team",
  ],
  employee: ["attendance:self", "correction:submit"],
} as const satisfies Record<string, readonly Permission[]>;

export type DefaultRoleName = keyof typeof DEFAULT_ROLES;

/** The authenticated caller, attached to the request by JwtAuthGuard. */
export type AuthUser = {
  id: string;
  sessionId: string;
  organizationId: string;
  permissions: readonly Permission[];
};
