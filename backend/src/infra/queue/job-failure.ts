import type { Job } from "bullmq";
import type { PinoLogger } from "nestjs-pino";

/**
 * docs/15-background-jobs.md — a failed attempt that will be retried is a warning;
 * the last one is an error (the job stays in Redis for inspection).
 * Logs ids only: job data never holds secrets, but it can hold personal data.
 */
export function logJobFailure(logger: PinoLogger, job: Job | undefined, error: Error): void {
  const attempts = job?.opts.attempts ?? 1;
  const context = { err: error, jobId: job?.id, jobName: job?.name, attempt: job?.attemptsMade };
  if (job && job.attemptsMade < attempts) logger.warn(context, "Job attempt failed, will retry");
  else logger.error(context, "Job failed after its last attempt");
}
