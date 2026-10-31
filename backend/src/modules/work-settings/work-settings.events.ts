import type { AuditableEvent } from "@/common/events/auditable-event.js";

/**
 * docs/15-background-jobs.md#in-process-events — the audit log records every
 * work_schedule.* and organization.* event.
 */
export const WORK_SETTINGS_EVENTS = {
  scheduleCreated: "work_schedule.created",
  settingsUpdated: "organization.settings_updated",
} as const;

export class WorkScheduleEvent implements AuditableEvent {
  readonly name = WORK_SETTINGS_EVENTS.scheduleCreated;
  readonly targetType = "work_schedule";

  constructor(
    readonly organizationId: string,
    readonly actorId: string | null,
    readonly targetId: string,
    readonly metadata: Record<string, unknown> = {},
  ) {}
}

export class OrganizationSettingsEvent implements AuditableEvent {
  readonly name = WORK_SETTINGS_EVENTS.settingsUpdated;
  readonly targetType = "organization";

  constructor(
    readonly organizationId: string,
    readonly actorId: string | null,
    readonly metadata: Record<string, unknown> = {},
  ) {}

  get targetId(): string {
    return this.organizationId;
  }
}
