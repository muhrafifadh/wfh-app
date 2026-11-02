import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";

import { PinoLogger } from "nestjs-pino";

import { EmployeeDirectory } from "@/common/contracts/directory.js";
import { addDays, toDateColumn, zonedToUtc, type LocalDate } from "@/common/time/zoned-time.js";
import type { AuthUser } from "@/common/types/auth.js";
import { Clock } from "@/infra/clock/clock.js";
import {
  CLOSE_DAY_BATCH_SIZE,
  CLOSE_DAY_DELAY_MS,
} from "@/modules/attendance/attendance.constants.js";
import { CloseDayDateNotEndedError } from "@/modules/attendance/attendance.errors.js";
import { ATTENDANCE_EVENTS, CloseDayEvent } from "@/modules/attendance/attendance.events.js";
import { AttendanceRepository } from "@/modules/attendance/attendance.repository.js";
import type { NonWorkingReason } from "@/modules/holidays/holidays.constants.js";
import { HolidaysService } from "@/modules/holidays/holidays.service.js";
import { boundariesFor } from "@/modules/work-settings/domain/schedule-policy.js";
import { WorkSettingsService } from "@/modules/work-settings/work-settings.service.js";

export type CloseDayResult = {
  runId: string;
  workDate: LocalDate;
  isWorkingDay: boolean;
  /** Why nothing was processed; null on a working day. */
  reason: NonWorkingReason | null;
  /** ABSENT rows created. */
  created: number;
  /** Eligible employees who already had a record (checked in, or an earlier run). */
  skipped: number;
  /** Employees in batches that failed; the run is retried and they're picked up again. */
  failed: number;
};

/** Thrown after a run with failed batches, so the job is retried (it's idempotent). */
export class CloseDayIncompleteError extends Error {
  constructor(readonly result: CloseDayResult) {
    super(`Close-day ${result.runId} left ${result.failed} employees unprocessed`);
  }
}

export const newCloseDayRunId = () => `cd-${randomUUID()}`;

/**
 * DOMAIN_RULES.md §10 — after a working day ends, every active, employed employee
 * without a record gets one ABSENT record (completion not_applicable). Inserts skip
 * existing rows, so re-runs, retries and overlapping runs give the same result and
 * never touch check-ins (open records stay open).
 */
@Injectable()
export class CloseDayService {
  constructor(
    private readonly repo: AttendanceRepository,
    private readonly employees: EmployeeDirectory,
    private readonly workSettings: WorkSettingsService,
    private readonly holidays: HolidaysService,
    private readonly clock: Clock,
    private readonly events: EventEmitter2,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(CloseDayService.name);
  }

  /** Organizations whose previous work date is due for closing now (00:05 local or later). */
  async dueRuns(now: Date): Promise<{ organizationId: string; workDate: LocalDate }[]> {
    const due: { organizationId: string; workDate: LocalDate }[] = [];
    for (const organizationId of await this.workSettings.organizationIds()) {
      const today = await this.workSettings.today(organizationId, now);
      const startsAt = zonedToUtc(today.workDate, CLOSE_DAY_DELAY_MS, today.timezone);
      if (now >= startsAt) due.push({ organizationId, workDate: addDays(today.workDate, -1) });
    }
    return due;
  }

  /** The scheduled run (job). Audited without an actor. */
  async runScheduled(
    organizationId: string,
    workDate: LocalDate,
    runId: string,
  ): Promise<CloseDayResult> {
    const result = await this.close(organizationId, workDate, runId);
    await this.events.emitAsync(
      ATTENDANCE_EVENTS.markedAbsent,
      new CloseDayEvent(ATTENDANCE_EVENTS.markedAbsent, organizationId, null, { ...result }),
    );
    if (result.failed > 0) throw new CloseDayIncompleteError(result);
    return result;
  }

  /** POST /attendance/close-day — Admin/HR re-runs a date that has ended. Audited. */
  async rerun(user: AuthUser, workDate: LocalDate): Promise<CloseDayResult> {
    const today = await this.workSettings.today(user.organizationId, this.clock.now());
    if (workDate >= today.workDate) throw new CloseDayDateNotEndedError(today.workDate);

    const result = await this.close(user.organizationId, workDate, newCloseDayRunId());
    await this.events.emitAsync(
      ATTENDANCE_EVENTS.closeDayRerun,
      new CloseDayEvent(ATTENDANCE_EVENTS.closeDayRerun, user.organizationId, user.id, {
        ...result,
      }),
    );
    return result;
  }

  private async close(
    organizationId: string,
    workDate: LocalDate,
    runId: string,
  ): Promise<CloseDayResult> {
    const result: CloseDayResult = {
      runId,
      workDate,
      isWorkingDay: false,
      reason: null,
      created: 0,
      skipped: 0,
      failed: 0,
    };
    const day = await this.holidays.isWorkingDay(organizationId, workDate);
    if (!day.isWorkingDay || !day.schedule) {
      result.reason = day.reason ?? "no_schedule";
      this.logger.info({ organizationId, ...result }, "Close-day skipped a non-working day");
      return result;
    }
    result.isWorkingDay = true;

    // ABSENT rows have no check-in, but keep the day's boundaries for corrections (§11.1)
    const b = boundariesFor(day.schedule, workDate);
    const snapshot = {
      organizationId,
      workScheduleId: day.schedule.id,
      workDate: toDateColumn(workDate),
      scheduleTimezone: day.schedule.timezone,
      scheduledStartAt: b.scheduledStartAt,
      scheduledEndAt: b.scheduledEndAt,
      onTimeDeadlineAt: b.onTimeDeadlineAt,
      checkInOpensAt: b.checkInOpensAt,
      checkInClosesAt: b.checkInClosesAt,
      checkOutClosesAt: b.checkOutClosesAt,
      closeDayRunId: runId,
    };

    let afterId: string | null = null;
    for (;;) {
      const ids = await this.employees.eligibleIdsOn(
        organizationId,
        workDate,
        afterId,
        CLOSE_DAY_BATCH_SIZE,
      );
      if (ids.length === 0) break;
      afterId = ids.at(-1) ?? null;
      try {
        const created = await this.repo.insertAbsences(
          ids.map((employeeId) => ({ ...snapshot, employeeId })),
        );
        result.created += created;
        result.skipped += ids.length - created;
      } catch (error) {
        // Keep going: the other batches still count, and the retry picks these up
        result.failed += ids.length;
        this.logger.error(
          { err: error, organizationId, runId, workDate, batch: ids.length },
          "Close-day batch failed",
        );
      }
    }

    this.logger.info({ organizationId, ...result }, "Close-day finished");
    return result;
  }
}
