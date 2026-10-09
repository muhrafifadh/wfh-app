import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import type { OnModuleInit } from "@nestjs/common";

import type { Job, Queue } from "bullmq";
import { PinoLogger } from "nestjs-pino";

import { logJobFailure } from "@/infra/queue/job-failure.js";
import {
  UPLOADS_CLEANUP_CRON,
  UPLOADS_CLEANUP_QUEUE,
  UPLOADS_CLEANUP_SCHEDULER,
} from "@/modules/uploads/jobs/uploads-cleanup.queue.js";
import { UploadsService } from "@/modules/uploads/uploads.service.js";

/** Removes abandoned uploads and the files of deleted ones. One at a time: it's housekeeping. */
@Processor(UPLOADS_CLEANUP_QUEUE, { concurrency: 1 })
export class UploadsCleanupProcessor extends WorkerHost implements OnModuleInit {
  constructor(
    private readonly uploads: UploadsService,
    private readonly logger: PinoLogger,
    @InjectQueue(UPLOADS_CLEANUP_QUEUE) private readonly queue: Queue,
  ) {
    super();
    this.logger.setContext(UploadsCleanupProcessor.name);
  }

  /** Upsert: every instance can call this on startup and there is still one schedule. */
  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      UPLOADS_CLEANUP_SCHEDULER,
      { pattern: UPLOADS_CLEANUP_CRON, tz: "UTC" },
      { name: "purge-expired" },
    );
  }

  async process(job: Job): Promise<void> {
    const purged = await this.uploads.purgeExpired();
    this.logger.info({ jobId: job.id, purged }, "Expired uploads purged");
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job | undefined, error: Error): void {
    logJobFailure(this.logger, job, error);
  }
}
