import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";

import type { Job } from "bullmq";
import { PinoLogger } from "nestjs-pino";

import { logJobFailure } from "@/infra/queue/job-failure.js";
import {
  USER_EMAILS_QUEUE,
  userEmailJobSchema,
  type UserEmailJobName,
} from "@/modules/users/jobs/user-emails.queue.js";
import { UsersService } from "@/modules/users/users.service.js";

/**
 * docs/15-background-jobs.md — sends invitation and verification emails.
 * Concurrency 5: well under typical SMTP provider rate limits.
 */
@Processor(USER_EMAILS_QUEUE, { concurrency: 5 })
export class UserEmailsProcessor extends WorkerHost {
  constructor(
    private readonly users: UsersService,
    private readonly logger: PinoLogger,
  ) {
    super();
    this.logger.setContext(UserEmailsProcessor.name);
  }

  async process(job: Job<unknown, void, UserEmailJobName>): Promise<void> {
    const { userId } = userEmailJobSchema.parse(job.data);
    switch (job.name) {
      case "invitation":
        await this.users.sendInvitation(userId);
        break;
      case "email-verification":
        await this.users.sendEmailVerification(userId);
        break;
      default:
        throw new Error(`Unknown job name: ${String(job.name)}`);
    }
    this.logger.info({ jobId: job.id, jobName: job.name, userId }, "User email processed");
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job | undefined, error: Error): void {
    logJobFailure(this.logger, job, error);
  }
}
