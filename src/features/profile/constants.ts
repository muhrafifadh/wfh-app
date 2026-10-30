// Same values as the backend's src/modules/employees/employees.constants.ts
export const EMPLOYEE_STATUSES = ["active", "inactive"] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

// Same values as the backend's src/modules/users/users.constants.ts
export const ACCOUNT_STATUSES = ["active", "invited", "deactivated"] as const;
