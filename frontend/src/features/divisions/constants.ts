// Same values as the backend's src/modules/divisions/divisions.constants.ts
export const DIVISION_STATUSES = ["active", "inactive"] as const;
export type DivisionStatus = (typeof DIVISION_STATUSES)[number];

export const DIVISION_STATUS_LABEL = {
  active: "Active",
  inactive: "Inactive",
} as const satisfies Record<DivisionStatus, string>;

export const DIVISION_SORT_FIELDS = ["name", "code", "createdAt"] as const;
export type DivisionSortField = (typeof DIVISION_SORT_FIELDS)[number];

/** Backend DIVISION_CODE_PATTERN: 2–32 of A–Z, 0–9 and "-", not starting with "-". */
export const DIVISION_CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{1,31}$/;
