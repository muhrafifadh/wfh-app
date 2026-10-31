// Same values as the backend's src/modules/employees/employees.constants.ts
export const EMPLOYEE_STATUSES = ["active", "inactive"] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export const EMPLOYEE_STATUS_LABEL = {
  active: "Active",
  inactive: "Inactive",
} as const satisfies Record<EmployeeStatus, string>;

export const EMPLOYEE_SORT_FIELDS = ["employeeNumber", "fullName", "createdAt"] as const;
export type EmployeeSortField = (typeof EMPLOYEE_SORT_FIELDS)[number];

/** Backend EMPLOYEE_NUMBER_PATTERN, e.g. EMP-011. */
export const EMPLOYEE_NUMBER_PATTERN = /^[A-Z0-9][A-Z0-9-]{2,31}$/;

// The linked user's status (backend src/modules/users/users.constants.ts)
export const ACCOUNT_STATUSES = ["active", "invited", "deactivated"] as const;
