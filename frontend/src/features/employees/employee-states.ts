import type { Employee } from "@/features/employees/schemas";

export type AccountState = "none" | "invited" | "active" | "deactivated";

/** UX_FLOWS.md §12.4: never merged into one "Inactive" label. */
export const ACCOUNT_STATE_LABEL = {
  none: "No account",
  invited: "Invitation pending",
  active: "Can sign in",
  deactivated: "Sign-in disabled",
} as const satisfies Record<AccountState, string>;

export function accountStateOf(employee: Pick<Employee, "account">): AccountState {
  return employee.account?.status ?? "none";
}

/** The employment end date is before today (organization date). */
export function employmentEnded(
  employee: Pick<Employee, "employmentEndDate">,
  today: string,
): boolean {
  return employee.employmentEndDate !== null && employee.employmentEndDate < today;
}

/**
 * Situations an admin should notice on the detail page, each with what it means.
 * Empty when everything lines up (active employee, active account, employed).
 */
export function employeeNotices(employee: Employee, today: string): string[] {
  const notices: string[] = [];
  const account = accountStateOf(employee);
  if (account === "none") {
    notices.push("Not linked to an account yet, so they can't sign in or record attendance.");
  }
  if (account === "invited") {
    notices.push("Invitation pending: they haven't set a password yet.");
  }
  if (employee.status === "inactive" && account === "active") {
    notices.push(
      "The employee is inactive but their account can still sign in. Deactivate the user on the Users page to block sign-in.",
    );
  }
  if (employee.status === "active" && account === "deactivated") {
    notices.push("The employee is active but their account's sign-in is disabled.");
  }
  if (employmentEnded(employee, today) && employee.status === "active") {
    notices.push("Their employment end date has passed, but the employee is still active.");
  }
  return notices;
}
