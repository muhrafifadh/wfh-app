import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";

import type { Job } from "bullmq";
import { PinoLogger } from "nestjs-pino";

import { AUDIT_EVENTS_QUEUE, auditEventJobSchema } from "@/common/contracts/service-events.js";
import { logJobFailure } from "@/infra/queue/job-failure.js";
import { AuditService } from "@/modules/audit/audit.service.js";

/** Writes the attendance service's domain events to the audit log. */
@Processor(AUDIT_EVENTS_QUEUE)
export class AuditEventsProcessor extends WorkerHost {
  constructor(
    private readonly audit: AuditService,
    private readonly logger: PinoLogger,
  ) {
    super();
    this.logger.setContext(AuditEventsProcessor.name);
  }

  async process(job: Job<unknown>): Promise<void> {
    const { event, requestId } = auditEventJobSchema.parse(job.data);
    await this.audit.record(event, requestId);
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job | undefined, error: Error): void {
    logJobFailure(this.logger, job, error);
  }
}
