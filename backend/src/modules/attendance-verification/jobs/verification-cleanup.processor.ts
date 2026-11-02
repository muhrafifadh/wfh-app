import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import type { OnModuleInit } from "@nestjs/common";

import type { Job, Queue } from "bullmq";
import { PinoLogger } from "nestjs-pino";

import { logJobFailure } from "@/infra/queue/job-failure.js";
import { AttendanceVerificationService } from "@/modules/attendance-verification/attendance-verification.service.js";
import {
  VERIFICATION_CLEANUP_CRON,
  VERIFICATION_CLEANUP_QUEUE,
  VERIFICATION_CLEANUP_SCHEDULER,
} from "@/modules/attendance-verification/jobs/verification-cleanup.queue.js";

/** Decisions V3 and V8: deletes expired photos and results. One at a time: it's housekeeping. */
@Processor(VERIFICATION_CLEANUP_QUEUE, { concurrency: 1 })
export class VerificationCleanupProcessor extends WorkerHost implements OnModuleInit {
  constructor(
    private readonly verification: AttendanceVerificationService,
    private readonly logger: PinoLogger,
    @InjectQueue(VERIFICATION_CLEANUP_QUEUE) private readonly queue: Queue,
  ) {
    super();
    this.logger.setContext(VerificationCleanupProcessor.name);
  }

  /** Upsert: every instance can call this on startup and there is still one schedule. */
  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      VERIFICATION_CLEANUP_SCHEDULER,
      { pattern: VERIFICATION_CLEANUP_CRON, tz: "UTC" },
      { name: "purge-expired" },
    );
  }

  async process(job: Job): Promise<void> {
    const purged = await this.verification.purgeExpired();
    this.logger.info({ jobId: job.id, ...purged }, "Expired verification evidence purged");
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job | undefined, error: Error): void {
    logJobFailure(this.logger, job, error);
  }
}
