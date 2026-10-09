export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

/** Derived, not stored: deactivated (disabledAt set), invited (no password yet), or active. */
export const USER_STATUSES = ["active", "invited", "deactivated"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const USER_SORT_FIELDS = ["name", "email", "createdAt"] as const;
