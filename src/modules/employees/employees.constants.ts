export const EMPLOYEE_STATUSES = ["active", "inactive"] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export const EMPLOYEE_SORT_FIELDS = ["employeeNumber", "fullName", "createdAt"] as const;

/** DOMAIN_RULES.md §4.2 — uppercase, 3–32 characters (matches the check constraint). */
export const EMPLOYEE_NUMBER_PATTERN = /^[A-Z0-9][A-Z0-9-]{2,31}$/;

/** Upper bound when walking a reporting line, so bad data can't loop forever. */
export const MAX_REPORTING_DEPTH = 1000;

/** "2026-11-02" ↔ the Date Prisma uses for a `date` column (midnight UTC). */
export const toDateColumn = (date: string): Date => new Date(`${date}T00:00:00.000Z`);
export const fromDateColumn = (date: Date): string => date.toISOString().slice(0, 10);
