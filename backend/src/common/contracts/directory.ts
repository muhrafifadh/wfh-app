import { AppError } from "@/common/errors/app-error.js";
import type { AuthUser, Permission } from "@/common/types/auth.js";

/**
 * The boundary between the attendance side and the employee side. The attendance
 * service knows about people only through these two classes, never through the
 * employee service's modules or tables (docs/EMPLOYEE_ATTENDANCE_SPLIT_PLAN.md).
 */

export const EMPLOYEE_STATUSES = ["active", "inactive"] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

/** What attendance needs to know about an employee. */
export type EmployeeProfile = {
  id: string;
  employeeNumber: string;
  fullName: string;
  status: EmployeeStatus;
  employmentStartDate: string;
  employmentEndDate: string | null;
};

export type EmployeeSummary = {
  id: string;
  employeeNumber: string;
  fullName: string;
  status: EmployeeStatus;
  managerId: string | null;
};

export type Contact = { id: string; email: string; name: string; permissions: Permission[] };

export class EmployeeProfileRequiredError extends AppError {
  readonly status = 422;
  readonly code = "EMPLOYEE_PROFILE_REQUIRED";

  constructor() {
    super("Your account has no employee profile. Contact HR.");
  }
}

/** Checks an access token and its session, wherever those live. */
export abstract class Authenticator {
  abstract authenticate(accessToken: string): Promise<AuthUser>;
}

export abstract class EmployeeDirectory {
  /** The profile a user records attendance as, or null. */
  abstract findProfileForUser(
    organizationId: string,
    userId: string,
  ): Promise<EmployeeProfile | null>;

  /** One batch of employees close-day must account for on `date`. */
  abstract eligibleIdsOn(
    organizationId: string,
    date: string,
    afterId: string | null,
    take: number,
  ): Promise<string[]>;

  /**
   * The caller's team (§12): active direct reports of their own active profile.
   * Null when they have no active profile, so they lead no team.
   */
  abstract teamOf(
    organizationId: string,
    userId: string,
  ): Promise<{ managerId: string; employeeIds: string[] } | null>;

  /** Employee id → linked user id, for those of the given employees that have an account. */
  abstract accountsOf(organizationId: string, ids: string[]): Promise<Map<string, string>>;

  /**
   * The employee's name and the account of their direct manager, when that manager's
   * profile is active and linked to an account. Null if the employee isn't found.
   */
  abstract reportingLineOf(
    organizationId: string,
    employeeId: string,
  ): Promise<{ fullName: string; managerUserId: string | null } | null>;

  /** Id → number, name, status and manager, for the given employees of the organization. */
  abstract summariesByIds(
    organizationId: string,
    ids: string[],
  ): Promise<Map<string, EmployeeSummary>>;
}

export abstract class UserDirectory {
  /** Id → display name, for users of the organization. */
  abstract namesByIds(organizationId: string, ids: string[]): Promise<Map<string, string>>;

  /** The given users of the organization that are active accounts. */
  abstract contactsByIds(organizationId: string, ids: string[]): Promise<Contact[]>;

  /** Every active account of the organization whose role has this permission. */
  abstract contactsWithPermission(
    organizationId: string,
    permission: Permission,
  ): Promise<Contact[]>;
}
