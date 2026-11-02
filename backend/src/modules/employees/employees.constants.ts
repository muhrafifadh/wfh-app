export { EMPLOYEE_STATUSES, type EmployeeStatus } from "@/common/contracts/directory.js";

export const EMPLOYEE_SORT_FIELDS = ["employeeNumber", "fullName", "createdAt"] as const;

/** DOMAIN_RULES.md §4.2 — uppercase, 3–32 characters (matches the check constraint). */
export const EMPLOYEE_NUMBER_PATTERN = /^[A-Z0-9][A-Z0-9-]{2,31}$/;

/** Upper bound when walking a reporting line, so bad data can't loop forever. */
export const MAX_REPORTING_DEPTH = 1000;
