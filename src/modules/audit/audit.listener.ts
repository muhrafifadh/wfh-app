import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import type { AuditableEvent } from "@/common/events/auditable-event.js";
import { AuditService } from "@/modules/audit/audit.service.js";

/**
 * Records domain events without the emitting modules knowing about auditing.
 * Emitters use emitAsync(), so the entry is written before the response is sent.
 * To audit another module, add a handler for its namespace (e.g. "holiday.*").
 */
@Injectable()
export class AuditListener {
  constructor(private readonly audit: AuditService) {}

  /** Every USER_EVENTS name (src/modules/users/users.events.ts). */
  @OnEvent("user.*")
  async onUserEvent(event: AuditableEvent): Promise<void> {
    await this.audit.record(event);
  }

  /** DIVISION_EVENTS (src/modules/divisions/divisions.events.ts). */
  @OnEvent("division.*")
  async onDivisionEvent(event: AuditableEvent): Promise<void> {
    await this.audit.record(event);
  }

  /** EMPLOYEE_EVENTS (src/modules/employees/employees.events.ts). */
  @OnEvent("employee.*")
  async onEmployeeEvent(event: AuditableEvent): Promise<void> {
    await this.audit.record(event);
  }

  /** WORK_SETTINGS_EVENTS (src/modules/work-settings/work-settings.events.ts). */
  @OnEvent("work_schedule.*")
  async onWorkScheduleEvent(event: AuditableEvent): Promise<void> {
    await this.audit.record(event);
  }

  @OnEvent("organization.*")
  async onOrganizationEvent(event: AuditableEvent): Promise<void> {
    await this.audit.record(event);
  }

  /** HOLIDAY_EVENTS (src/modules/holidays/holidays.events.ts). */
  @OnEvent("holiday.*")
  async onHolidayEvent(event: AuditableEvent): Promise<void> {
    await this.audit.record(event);
  }

  /** ATTENDANCE_EVENTS (src/modules/attendance/attendance.events.ts). */
  @OnEvent("attendance.*")
  async onAttendanceEvent(event: AuditableEvent): Promise<void> {
    await this.audit.record(event);
  }

  /** CORRECTION_EVENTS (src/modules/corrections/corrections.events.ts). */
  @OnEvent("correction.*")
  async onCorrectionEvent(event: AuditableEvent): Promise<void> {
    await this.audit.record(event);
  }

  /** REPORT_EVENTS (src/modules/reports/reports.events.ts). */
  @OnEvent("report_export.*")
  async onReportExportEvent(event: AuditableEvent): Promise<void> {
    await this.audit.record(event);
  }
}
