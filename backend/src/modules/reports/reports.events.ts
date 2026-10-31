import type { AuditableEvent } from "@/common/events/auditable-event.js";

/** docs/15-background-jobs.md#in-process-events — the audit log records every report_export.* event. */
export const REPORT_EVENTS = {
  exported: "report_export.created",
} as const;

/** A synchronous export has no stored artifact, so there is no target id (DATA_MODEL.md §9.1). */
export class ReportExportEvent implements AuditableEvent {
  readonly name = REPORT_EVENTS.exported;
  readonly targetType = "report_export";
  readonly targetId = null;

  constructor(
    readonly organizationId: string,
    readonly actorId: string,
    readonly metadata: Record<string, unknown>,
  ) {}
}
