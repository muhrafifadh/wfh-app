import type { AuditableEvent } from "@/common/events/auditable-event.js";

/** docs/15-background-jobs.md#in-process-events — the audit log records every division.* event. */
export const DIVISION_EVENTS = {
  created: "division.created",
  updated: "division.updated",
  deactivated: "division.deactivated",
  reactivated: "division.reactivated",
} as const;

export type DivisionEventName = (typeof DIVISION_EVENTS)[keyof typeof DIVISION_EVENTS];

export class DivisionEvent implements AuditableEvent {
  readonly targetType = "division";

  constructor(
    readonly name: DivisionEventName,
    readonly organizationId: string,
    readonly actorId: string | null,
    readonly targetId: string,
    readonly metadata: Record<string, unknown> = {},
  ) {}
}
