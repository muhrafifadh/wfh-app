import type { DefaultJobOptions } from "bullmq";

/**
 * docs/15-background-jobs.md — every queue starts from these. Retries with
 * exponential backoff from 10 s; failed jobs are kept a week for inspection.
 */
export const DEFAULT_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: "exponential", delay: 10_000 },
  removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
  removeOnFail: { age: 7 * 24 * 60 * 60 },
} as const satisfies DefaultJobOptions;
