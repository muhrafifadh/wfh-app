import type { AuditableEvent } from "@/common/events/auditable-event.js";

/** docs/15-background-jobs.md#in-process-events — the audit log records every attendance.* event. */
export const ATTENDANCE_EVENTS = {
  checkedIn: "attendance.checked_in",
  checkedOut: "attendance.checked_out",
  /** A scheduled close-day run (one entry per organization and date). */
  markedAbsent: "attendance.marked_absent",
  /** Admin/HR re-ran close-day for a date. */
  closeDayRerun: "attendance.close_day_rerun",
} as const;

export type AttendanceEventName = (typeof ATTENDANCE_EVENTS)[keyof typeof ATTENDANCE_EVENTS];

/** Close-day concerns the whole organization, so that's the target. */
export class CloseDayEvent implements AuditableEvent {
  readonly targetType = "organization";

  constructor(
    readonly name: typeof ATTENDANCE_EVENTS.markedAbsent | typeof ATTENDANCE_EVENTS.closeDayRerun,
    readonly organizationId: string,
    readonly actorId: string | null,
    readonly metadata: Record<string, unknown>,
  ) {}

  get targetId(): string {
    return this.organizationId;
  }
}

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
