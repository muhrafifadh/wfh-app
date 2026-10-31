import type { AuditableEvent } from "@/common/events/auditable-event.js";

/** docs/15-background-jobs.md#in-process-events — the audit log records every holiday.* event. */
export const HOLIDAY_EVENTS = {
  created: "holiday.created",
  updated: "holiday.updated",
  deleted: "holiday.deleted",
} as const;

export type HolidayEventName = (typeof HOLIDAY_EVENTS)[keyof typeof HOLIDAY_EVENTS];

export class HolidayEvent implements AuditableEvent {
  readonly targetType = "holiday";

  constructor(
    readonly name: HolidayEventName,
    readonly organizationId: string,
    readonly actorId: string | null,
    readonly targetId: string,
    readonly metadata: Record<string, unknown> = {},
  ) {}
}
