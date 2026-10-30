import type { AuditableEvent } from "@/common/events/auditable-event.js";

/** docs/15-background-jobs.md#in-process-events — the audit log records every correction.* event. */
export const CORRECTION_EVENTS = {
  submitted: "correction.submitted",
  approved: "correction.approved",
  rejected: "correction.rejected",
} as const;

export type CorrectionEventName = (typeof CORRECTION_EVENTS)[keyof typeof CORRECTION_EVENTS];

/** Metadata holds ids and changed fields only; full before/after lives in CorrectionSnapshot. */
export class CorrectionEvent implements AuditableEvent {
  readonly targetType = "correction_request";

  constructor(
    readonly name: CorrectionEventName,
    readonly organizationId: string,
    readonly actorId: string | null,
    readonly targetId: string,
    readonly metadata: Record<string, unknown> = {},
  ) {}
}
