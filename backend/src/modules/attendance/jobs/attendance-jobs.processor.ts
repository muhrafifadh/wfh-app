import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import type { OnModuleInit } from "@nestjs/common";

import type { Job, Queue } from "bullmq";
import { PinoLogger } from "nestjs-pino";

import { Clock } from "@/infra/clock/clock.js";
import { logJobFailure } from "@/infra/queue/job-failure.js";
import { CloseDayService, newCloseDayRunId } from "@/modules/attendance/close-day.service.js";
import { IdempotencyRepository } from "@/modules/attendance/idempotency.repository.js";
import {
  ATTENDANCE_JOB_NAMES,
  ATTENDANCE_JOBS_QUEUE,
  CLOSE_DAY_JOB_RETENTION_S,
  CLOSE_DAY_TICK_CRON,
  CLOSE_DAY_TICK_SCHEDULER,
  closeDayJobId,
  closeDayJobSchema,
  PURGE_IDEMPOTENCY_CRON,
  PURGE_IDEMPOTENCY_SCHEDULER,
} from "@/modules/attendance/jobs/attendance-jobs.queue.js";

/** Close-day and housekeeping. One at a time: runs are per organization and cheap. */
@Processor(ATTENDANCE_JOBS_QUEUE, { concurrency: 1 })
export class AttendanceJobsProcessor extends WorkerHost implements OnModuleInit {
  constructor(
    private readonly closeDay: CloseDayService,
    private readonly idempotency: IdempotencyRepository,
    private readonly clock: Clock,
    private readonly logger: PinoLogger,
    @InjectQueue(ATTENDANCE_JOBS_QUEUE) private readonly queue: Queue,
  ) {
    super();
    this.logger.setContext(AttendanceJobsProcessor.name);
  }

  /** Upsert: every instance can call this on startup and there is still one schedule each. */
  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      CLOSE_DAY_TICK_SCHEDULER,
      { pattern: CLOSE_DAY_TICK_CRON, tz: "UTC" },
      { name: ATTENDANCE_JOB_NAMES.closeDayTick },
    );
    await this.queue.upsertJobScheduler(
      PURGE_IDEMPOTENCY_SCHEDULER,
      { pattern: PURGE_IDEMPOTENCY_CRON, tz: "UTC" },
      { name: ATTENDANCE_JOB_NAMES.purgeIdempotency },
    );
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case ATTENDANCE_JOB_NAMES.closeDayTick:
        await this.enqueueDue();
        return;
      case ATTENDANCE_JOB_NAMES.closeDay: {
        const { organizationId, workDate, runId } = closeDayJobSchema.parse(job.data);
        await this.closeDay.runScheduled(organizationId, workDate, runId);
        return;
      }
      case ATTENDANCE_JOB_NAMES.purgeIdempotency: {
        const purged = await this.idempotency.purgeExpired(this.clock.now());
        this.logger.info({ jobId: job.id, purged }, "Expired idempotency records purged");
        return;
      }
      default:
        throw new Error(`Unknown attendance job "${job.name}"`);
    }
  }

  /** Adds close-day for every organization that is due; repeats are dropped by job id. */
  async enqueueDue(): Promise<string[]> {
    const due = await this.closeDay.dueRuns(this.clock.now());
    const ids: string[] = [];
    for (const { organizationId, workDate } of due) {
      const jobId = closeDayJobId(organizationId, workDate);
      await this.queue.add(
        ATTENDANCE_JOB_NAMES.closeDay,
        { organizationId, workDate, runId: newCloseDayRunId() },
        {
          jobId,
          removeOnComplete: { age: CLOSE_DAY_JOB_RETENTION_S },
          removeOnFail: { age: CLOSE_DAY_JOB_RETENTION_S },
        },
      );
      ids.push(jobId);
    }
    return ids;
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job | undefined, error: Error): void {
    logJobFailure(this.logger, job, error);
  }
}
