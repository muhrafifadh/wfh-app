import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import type { Queue } from "bullmq";
import { ClsService } from "nestjs-cls";
import { PinoLogger } from "nestjs-pino";

import { AUDIT_EVENTS_QUEUE, type AuditEventJob } from "@/common/contracts/service-events.js";
import type { AuditableEvent } from "@/common/events/auditable-event.js";
import { VERIFICATION_EVENTS } from "@/modules/attendance-verification/attendance-verification.events.js";

/**
 * Seeing someone's photo must leave a trace (decision V9), so these refuse the request
 * when the audit message can't be sent. They run before the link is handed out.
 */
const MUST_BE_AUDITED: ReadonlySet<string> = new Set([
  VERIFICATION_EVENTS.photoViewed,
  VERIFICATION_EVENTS.photoDisclosed,
]);

/** Sends this service's domain events to the audit log, which the employee service owns. */
@Injectable()
export class AuditForwarderListener {
  constructor(
    private readonly cls: ClsService,
    private readonly logger: PinoLogger,
    @InjectQueue(AUDIT_EVENTS_QUEUE) private readonly queue: Queue<AuditEventJob>,
  ) {
    this.logger.setContext(AuditForwarderListener.name);
  }

  @OnEvent("work_schedule.*")
  onWorkScheduleEvent(event: AuditableEvent): Promise<void> {
    return this.forward(event);
  }

  @OnEvent("organization.*")
  onOrganizationEvent(event: AuditableEvent): Promise<void> {
    return this.forward(event);
  }

  @OnEvent("holiday.*")
  onHolidayEvent(event: AuditableEvent): Promise<void> {
    return this.forward(event);
  }

  @OnEvent("attendance.*")
  onAttendanceEvent(event: AuditableEvent): Promise<void> {
    return this.forward(event);
  }

  @OnEvent("attendance_verification.*")
  onVerificationEvent(event: AuditableEvent): Promise<void> {
    return this.forward(event);
  }

  @OnEvent("correction.*")
  onCorrectionEvent(event: AuditableEvent): Promise<void> {
    return this.forward(event);
  }

  @OnEvent("report_export.*")
  onReportExportEvent(event: AuditableEvent): Promise<void> {
    return this.forward(event);
  }

  private async forward(event: AuditableEvent): Promise<void> {
    try {
      await this.queue.add(event.name, {
        event: {
          name: event.name,
          organizationId: event.organizationId,
          actorId: event.actorId,
          targetType: event.targetType,
          targetId: event.targetId,
          metadata: event.metadata,
        },
        requestId: this.cls.isActive() ? (this.cls.getId() ?? null) : null,
      });
    } catch (error) {
      this.logger.error({ err: error, action: event.name }, "Forwarding an audit event failed");
      if (MUST_BE_AUDITED.has(event.name)) throw error;
    }
  }
}
