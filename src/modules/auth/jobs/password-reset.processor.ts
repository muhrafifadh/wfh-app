import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";

import type { Job } from "bullmq";
import { PinoLogger } from "nestjs-pino";

import { logJobFailure } from "@/infra/queue/job-failure.js";
import {
  PASSWORD_RESET_QUEUE,
  passwordResetJobSchema,
} from "@/modules/auth/jobs/password-reset.queue.js";
import { PasswordResetService } from "@/modules/auth/password-reset.service.js";

/** docs/15-background-jobs.md — the worked example: email delivery with retries. */
@Processor(PASSWORD_RESET_QUEUE, { concurrency: 5 })
export class PasswordResetProcessor extends WorkerHost {
  constructor(
    private readonly passwordReset: PasswordResetService,
    private readonly logger: PinoLogger,
  ) {
    super();
    this.logger.setContext(PasswordResetProcessor.name);
  }

  async process(job: Job): Promise<void> {
    const { userId } = passwordResetJobSchema.parse(job.data);
    // Safe to retry: each run issues a fresh link and retires the previous one
    await this.passwordReset.send(userId);
    this.logger.info({ jobId: job.id, userId }, "Password reset email sent");
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job | undefined, error: Error): void {
    logJobFailure(this.logger, job, error);
  }
}
