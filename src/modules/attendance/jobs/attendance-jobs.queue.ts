import { z } from "zod";

/** docs/15-background-jobs.md — queue owned by the attendance module. */
export const ATTENDANCE_JOBS_QUEUE = "attendance-jobs";

export const ATTENDANCE_JOB_NAMES = {
  /** Every 15 minutes: queues close-day for organizations past 00:05 local time. */
  closeDayTick: "close-day-tick",
  /** One organization and work date. */
  closeDay: "close-day",
  /** Daily: deletes expired idempotency records. */
  purgeIdempotency: "purge-idempotency",
} as const;

export const CLOSE_DAY_TICK_SCHEDULER = "close-day-tick";
/** Every 15 minutes, so 00:05 local is reached within 15 minutes in any zone (UTC+05:45 too). */
export const CLOSE_DAY_TICK_CRON = "5,20,35,50 * * * *";

export const PURGE_IDEMPOTENCY_SCHEDULER = "purge-idempotency-daily";
/** Every day at 03:30 UTC. */
export const PURGE_IDEMPOTENCY_CRON = "30 3 * * *";

/** The date is explicit, so a retry after midnight never closes the wrong day (ARCHITECTURE.md §12). */
export const closeDayJobSchema = z.object({
  organizationId: z.uuid(),
  workDate: z.iso.date(),
  runId: z.string().max(64),
});
export type CloseDayJob = z.infer<typeof closeDayJobSchema>;

/**
 * One job per organization and date: the tick adds it every 15 minutes, BullMQ keeps
 * just the first while it's stored (3 days). (BullMQ job ids can't contain ":".)
 */
export const closeDayJobId = (organizationId: string, workDate: string) =>
  `close-day-${organizationId}-${workDate}`;

export const CLOSE_DAY_JOB_RETENTION_S = 3 * 24 * 60 * 60;
