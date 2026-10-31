import { AppError } from "@/common/errors/app-error.js";

/** Numbers are never reused, so this includes deactivated employees. */
export class EmployeeNumberTakenError extends AppError {
  readonly status = 409;
  readonly code = "EMPLOYEE_NUMBER_TAKEN";

  constructor() {
    super("Another employee already has this employee number.", {
      fieldErrors: { employeeNumber: ["Already in use"] },
    });
  }
}

/** DOMAIN_RULES.md §4.3 — no one manages themselves, directly or through others. */
export class ReportingLineCycleError extends AppError {
  readonly status = 422;
  readonly code = "REPORTING_LINE_CYCLE";

  constructor() {
    super("This manager reports to the employee, directly or indirectly. Choose another manager.", {
      fieldErrors: { managerId: ["Would create a reporting cycle"] },
    });
  }
}

export class ManagerInactiveError extends AppError {
  readonly status = 422;
  readonly code = "MANAGER_INACTIVE";

  constructor() {
    super("The chosen manager is inactive. Choose an active employee.", {
      fieldErrors: { managerId: ["Manager is inactive"] },
    });
  }
}

export class EmploymentPeriodInvalidError extends AppError {
  readonly status = 422;
  readonly code = "EMPLOYMENT_PERIOD_INVALID";

  constructor() {
    super("The employment end date can't be before the start date.", {
      fieldErrors: { employmentEndDate: ["Must be on or after the start date"] },
    });
  }
}

export class EmployeeHasAccountError extends AppError {
  readonly status = 409;
  readonly code = "EMPLOYEE_HAS_ACCOUNT";

  constructor() {
    super("This employee already has a user account.");
  }
}

/** One user signs in as at most one employee (DATA_MODEL.md §4.3). */
export class UserHasEmployeeError extends AppError {
  readonly status = 409;
  readonly code = "USER_HAS_EMPLOYEE";

  constructor() {
    super("This user account already belongs to another employee.", {
      fieldErrors: { userId: ["Already linked"] },
    });
  }
}

/** DOMAIN_RULES.md §16 — the signed-in user has no employee profile. */
export class EmployeeProfileRequiredError extends AppError {
  readonly status = 422;
  readonly code = "EMPLOYEE_PROFILE_REQUIRED";

  constructor() {
    super("Your account has no employee profile. Contact HR.");
  }
}
