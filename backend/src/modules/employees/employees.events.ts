import type { AuditableEvent } from "@/common/events/auditable-event.js";

/**
 * docs/15-background-jobs.md#in-process-events — the audit log records every
 * employee.* event. Manager history lives here (employee.manager_changed).
 * Role changes are recorded by the users module (user.updated).
 */
export const EMPLOYEE_EVENTS = {
  created: "employee.created",
  updated: "employee.updated",
  managerChanged: "employee.manager_changed",
  deactivated: "employee.deactivated",
  reactivated: "employee.reactivated",
  accountLinked: "employee.account_linked",
} as const;

export type EmployeeEventName = (typeof EMPLOYEE_EVENTS)[keyof typeof EMPLOYEE_EVENTS];

export class EmployeeEvent implements AuditableEvent {
  readonly targetType = "employee";

  constructor(
    readonly name: EmployeeEventName,
    readonly organizationId: string,
    readonly actorId: string | null,
    readonly targetId: string,
    readonly metadata: Record<string, unknown> = {},
  ) {}
}
