import type { AuditableEvent } from "@/common/events/auditable-event.js";

/** docs/15-background-jobs.md#in-process-events — the audit log records every attendance.* event. */
export const ATTENDANCE_EVENTS = {
  checkedIn: "attendance.checked_in",
  checkedOut: "attendance.checked_out",
} as const;

export type AttendanceEventName = (typeof ATTENDANCE_EVENTS)[keyof typeof ATTENDANCE_EVENTS];

export class AttendanceEvent implements AuditableEvent {
  readonly targetType = "attendance";

  constructor(
    readonly name: AttendanceEventName,
    readonly organizationId: string,
    readonly actorId: string | null,
    readonly targetId: string,
    readonly metadata: Record<string, unknown> = {},
  ) {}
}
