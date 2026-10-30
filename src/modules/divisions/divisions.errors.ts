import { AppError } from "@/common/errors/app-error.js";

export class DivisionCodeTakenError extends AppError {
  readonly status = 409;
  readonly code = "DIVISION_CODE_TAKEN";

  constructor() {
    super("Another division already uses this code.", {
      fieldErrors: { code: ["Already in use"] },
    });
  }
}

/** Names are compared ignoring case: "engineering" clashes with "Engineering". */
export class DivisionNameTakenError extends AppError {
  readonly status = 409;
  readonly code = "DIVISION_NAME_TAKEN";

  constructor() {
    super("Another division already has this name.", {
      fieldErrors: { name: ["Already in use"] },
    });
  }
}

/** Employees can't be moved into a deactivated division. */
export class DivisionInactiveError extends AppError {
  readonly status = 422;
  readonly code = "DIVISION_INACTIVE";

  constructor() {
    super("This division is inactive. Reactivate it or choose another one.", {
      fieldErrors: { divisionId: ["Division is inactive"] },
    });
  }
}

/** UX_FLOWS §13: move the division's active employees elsewhere first. */
export class DivisionHasActiveEmployeesError extends AppError {
  readonly status = 409;
  readonly code = "DIVISION_HAS_ACTIVE_EMPLOYEES";

  constructor(activeEmployeeCount: number) {
    super("Move this division's active employees to another division before deactivating it.", {
      activeEmployeeCount,
    });
  }
}
