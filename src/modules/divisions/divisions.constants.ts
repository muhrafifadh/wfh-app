export const DIVISION_STATUSES = ["active", "inactive"] as const;
export type DivisionStatus = (typeof DIVISION_STATUSES)[number];

export const DIVISION_SORT_FIELDS = ["name", "code", "createdAt"] as const;

/** Uppercase letters, digits and hyphens, 2–32 characters (matches the check constraint). */
export const DIVISION_CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{1,31}$/;
