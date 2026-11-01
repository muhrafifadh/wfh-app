import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";

import type { Job } from "bullmq";
import { PinoLogger } from "nestjs-pino";

import { logJobFailure } from "@/infra/queue/job-failure.js";
import {
  NOTIFICATION_EMAILS_QUEUE,
  notificationEmailJobSchema,
} from "@/modules/notifications/jobs/notification-emails.queue.js";
import { NotificationsService } from "@/modules/notifications/notifications.service.js";

/**
 * docs/15-background-jobs.md — emails one notification per job. Concurrency 5: well
 * under typical SMTP provider rate limits.
 */
@Processor(NOTIFICATION_EMAILS_QUEUE, { concurrency: 5 })
export class NotificationEmailsProcessor extends WorkerHost {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly logger: PinoLogger,
  ) {
    super();
    this.logger.setContext(NotificationEmailsProcessor.name);
  }

  async process(job: Job): Promise<void> {
    const { notificationId } = notificationEmailJobSchema.parse(job.data);
    await this.notifications.deliver(notificationId);
  }

  /** After the last attempt the notification is marked failed with a safe code (§18.1). */
  @OnWorkerEvent("failed")
  async onFailed(job: Job | undefined, error: Error): Promise<void> {
    logJobFailure(this.logger, job, error);
    if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
    const parsed = notificationEmailJobSchema.safeParse(job.data);
    if (!parsed.success) return;
    try {
      await this.notifications.markFailed(parsed.data.notificationId);
    } catch (markError) {
      this.logger.error({ err: markError, jobId: job.id }, "Marking notification failed failed");
    }
  }
}
