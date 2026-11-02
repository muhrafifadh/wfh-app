import { z } from "zod";

/**
 * Messages between the two services (docs/EMPLOYEE_ATTENDANCE_SPLIT_PLAN.md). Queues rather
 * than plain pub/sub: a message waits in Redis if its consumer is down.
 */

/** Employee → attendance: the full row after each change. */
export const DIRECTORY_SYNC_QUEUE = "directory-sync";

/** Attendance → employee: domain events for the audit log, which the employee service owns. */
export const AUDIT_EVENTS_QUEUE = "audit-events";

/**
 * Short, steady retries rather than the default backoff: the usual failure is a row whose
 * parent's message is still on its way (an employee just ahead of their division).
 */
export const DIRECTORY_SYNC_JOB_OPTIONS = {
  attempts: 8,
  backoff: { type: "fixed", delay: 1_000 },
} as const;

/** Emitted in-process on the employee side; a new organization has no audited event of its own. */
export const ORGANIZATION_CREATED_EVENT = "directory.organization_created";

export const organizationSnapshotSchema = z.object({ id: z.uuid(), name: z.string() });

export const divisionSnapshotSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  code: z.string(),
  name: z.string(),
  status: z.enum(["active", "inactive"]),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().nullable(),
});

export const employeeSnapshotSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  userId: z.uuid().nullable(),
  divisionId: z.uuid(),
  managerId: z.uuid().nullable(),
  employeeNumber: z.string(),
  fullName: z.string(),
  status: z.enum(["active", "inactive"]),
  employmentStartDate: z.iso.datetime(),
  employmentEndDate: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().nullable(),
});

export type OrganizationSnapshot = z.infer<typeof organizationSnapshotSchema>;
export type DivisionSnapshot = z.infer<typeof divisionSnapshotSchema>;
export type EmployeeSnapshot = z.infer<typeof employeeSnapshotSchema>;
export type DirectorySyncJobName = "organization" | "division" | "employee";

export const auditEventJobSchema = z.object({
  event: z.object({
    name: z.string(),
    organizationId: z.uuid(),
    actorId: z.uuid().nullable(),
    targetType: z.string().nullable(),
    targetId: z.string().nullable(),
    metadata: z.record(z.string(), z.unknown()),
  }),
  /** Links the audit entry to the logs of the request that caused it. */
  requestId: z.string().nullable(),
});
export type AuditEventJob = z.infer<typeof auditEventJobSchema>;
