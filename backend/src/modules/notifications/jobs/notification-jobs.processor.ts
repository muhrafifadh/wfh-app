import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import type { OnModuleInit } from "@nestjs/common";

import type { Job, Queue } from "bullmq";
import { PinoLogger } from "nestjs-pino";

import { Clock } from "@/infra/clock/clock.js";
import { logJobFailure } from "@/infra/queue/job-failure.js";
import {
  NOTIFICATION_JOB_NAMES,
  NOTIFICATION_JOBS_QUEUE,
  PURGE_NOTIFICATIONS_CRON,
  PURGE_NOTIFICATIONS_SCHEDULER,
  REMINDERS_TICK_CRON,
  REMINDERS_TICK_SCHEDULER,
} from "@/modules/notifications/jobs/notification-jobs.queue.js";
import { NotificationsService } from "@/modules/notifications/notifications.service.js";

/** Reminders and retention. One at a time: each run is cheap and safe to repeat. */
@Processor(NOTIFICATION_JOBS_QUEUE, { concurrency: 1 })
export class NotificationJobsProcessor extends WorkerHost implements OnModuleInit {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly clock: Clock,
    private readonly logger: PinoLogger,
    @InjectQueue(NOTIFICATION_JOBS_QUEUE) private readonly queue: Queue,
  ) {
    super();
    this.logger.setContext(NotificationJobsProcessor.name);
  }

  /** Upsert: every instance can call this on startup and there is still one schedule each. */
  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      REMINDERS_TICK_SCHEDULER,
      { pattern: REMINDERS_TICK_CRON, tz: "UTC" },
      { name: NOTIFICATION_JOB_NAMES.remindersTick },
    );
    await this.queue.upsertJobScheduler(
      PURGE_NOTIFICATIONS_SCHEDULER,
      { pattern: PURGE_NOTIFICATIONS_CRON, tz: "UTC" },
      { name: NOTIFICATION_JOB_NAMES.purge },
    );
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case NOTIFICATION_JOB_NAMES.remindersTick:
        await this.notifications.createDueReminders(this.clock.now());
        return;
      case NOTIFICATION_JOB_NAMES.purge: {
        const purged = await this.notifications.purgeExpired(this.clock.now());
        this.logger.info({ jobId: job.id, purged }, "Old notifications purged");
        return;
      }
      default:
        throw new Error(`Unknown notification job "${job.name}"`);
    }
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job | undefined, error: Error): void {
    logJobFailure(this.logger, job, error);
  }
}
