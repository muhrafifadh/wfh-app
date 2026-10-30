import { createHash } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";

import { hashToken } from "@/common/crypto/tokens.js";
import type { Paginated } from "@/common/dto/pagination.js";
import { NotFoundError } from "@/common/errors/app-error.js";
import { addDays, fromDateColumn, toDateColumn, type LocalDate } from "@/common/time/zoned-time.js";
import type { AuthUser } from "@/common/types/auth.js";
import type { IdempotencyAction, Prisma } from "@/generated/prisma/client.js";
import { Clock } from "@/infra/clock/clock.js";
import { PrismaService } from "@/infra/prisma/prisma.service.js";
import {
  IDEMPOTENCY_KEY_PATTERN,
  IDEMPOTENCY_TTL_MS,
  type TodayState,
} from "@/modules/attendance/attendance.constants.js";
import {
  AlreadyCheckedInError,
  AlreadyCheckedOutError,
  CheckInTooEarlyError,
  CheckInWindowClosedError,
  CheckOutWindowClosedError,
  EmployeeInactiveError,
  IdempotencyKeyRequiredError,
  IdempotencyKeyReusedError,
  NotCheckedInError,
  NotWorkdayError,
} from "@/modules/attendance/attendance.errors.js";
import {
  ATTENDANCE_EVENTS,
  AttendanceEvent,
  type AttendanceEventName,
} from "@/modules/attendance/attendance.events.js";
import {
  snapshotOf,
  toAttendance,
  toScheduleBody,
} from "@/modules/attendance/attendance.mapper.js";
import {
  AttendanceRepository,
  DUPLICATE,
  type AttendanceRow,
} from "@/modules/attendance/attendance.repository.js";
import {
  canCheckOutAt,
  checkInWindowAt,
  isIncomplete,
  statusAtCheckIn,
  valuesFor,
  workedMinutesBetween,
} from "@/modules/attendance/domain/attendance-calculator.js";
import type {
  AttendanceResponseBody,
  AttendanceSummaryBody,
  TodayResponseBody,
} from "@/modules/attendance/dto/attendance.response.js";
import type {
  AttendanceSummaryQueryInput,
  ListMyAttendanceQueryInput,
} from "@/modules/attendance/dto/list-my-attendance.query.js";
import { IdempotencyRepository } from "@/modules/attendance/idempotency.repository.js";
import { EmployeeProfileRequiredError } from "@/modules/employees/employees.errors.js";
import { EmployeesService, type EmployeeProfile } from "@/modules/employees/employees.service.js";
import { HolidaysService } from "@/modules/holidays/holidays.service.js";
import { boundariesFor } from "@/modules/work-settings/domain/schedule-policy.js";
import { WorkSettingsService } from "@/modules/work-settings/work-settings.service.js";

/** What corrections need from a record (its owner, timestamps, snapshot, version). */
export type CorrectableAttendance = {
  id: string;
  employeeId: string;
  workDate: LocalDate;
  timezone: string;
  status: AttendanceRow["status"];
  checkInAt: Date | null;
  checkOutAt: Date | null;
  version: number;
  pendingCorrectionId: string | null;
};

/**
 * The record's domain fields before/after a correction (DATA_MODEL.md §8.2). Bump
 * ATTENDANCE_SNAPSHOT_VERSION when this shape changes.
 */
export type AttendanceSnapshot = {
  status: AttendanceRow["status"];
  completion: AttendanceRow["completion"];
  checkInAt: string | null;
  checkOutAt: string | null;
  lateMinutes: number;
  workedMinutes: number | null;
  version: number;
  correctedAt: string | null;
};
export const ATTENDANCE_SNAPSHOT_VERSION = 1;

const snapshotFields = (row: AttendanceRow): AttendanceSnapshot => ({
  status: row.status,
  completion: row.completion,
  checkInAt: row.checkInAt?.toISOString() ?? null,
  checkOutAt: row.checkOutAt?.toISOString() ?? null,
  lateMinutes: row.lateMinutes,
  workedMinutes: row.workedMinutes,
  version: row.version,
  correctedAt: row.correctedAt?.toISOString() ?? null,
});

/** A check-in/out result, and whether it was replayed from an earlier request. */
export type ActionResult = { body: AttendanceResponseBody; replayed: boolean };

/** §4.3 — active, and the date is inside the employment period. */
const isEligibleOn = (employee: EmployeeProfile, date: LocalDate): boolean =>
  employee.status === "active" &&
  employee.employmentStartDate <= date &&
  (employee.employmentEndDate === null || date <= employee.employmentEndDate);

const lastDayOfMonth = (month: string): LocalDate => {
  const [year, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10);
};

@Injectable()
export class AttendanceService {
  constructor(
    private readonly repo: AttendanceRepository,
    private readonly idempotency: IdempotencyRepository,
    private readonly prisma: PrismaService,
    private readonly employees: EmployeesService,
    private readonly workSettings: WorkSettingsService,
    private readonly holidays: HolidaysService,
    private readonly clock: Clock,
    private readonly events: EventEmitter2,
  ) {}

  // Today (UX_FLOWS.md §7.2)

  async today(user: AuthUser): Promise<TodayResponseBody> {
    const now = this.clock.now();
    const [today, employee, supportContact] = await Promise.all([
      this.workSettings.today(user.organizationId, now),
      this.employees.findProfileForUser(user.organizationId, user.id),
      this.workSettings.supportContactOf(user.organizationId),
    ]);
    const day = await this.holidays.isWorkingDay(user.organizationId, today.workDate);
    const record = employee
      ? await this.repo.findForDate(user.organizationId, employee.id, today.workDate)
      : null;
    const boundaries = record
      ? snapshotOf(record)
      : day.schedule && {
          ...boundariesFor(day.schedule, today.workDate),
          timezone: day.schedule.timezone,
        };

    let state: TodayState;
    if (!employee) state = "no_profile";
    else if (!isEligibleOn(employee, today.workDate)) state = "inactive";
    else if (record) {
      state = record.checkOutAt
        ? "checked_out"
        : canCheckOutAt(now, record.checkOutClosesAt)
          ? "checked_in"
          : "check_out_closed";
    } else if (!day.isWorkingDay || !boundaries) state = "non_working_day";
    else {
      state = { too_early: "before_window", open: "ready_to_check_in", closed: "window_closed" }[
        checkInWindowAt(now, boundaries)
      ] as TodayState;
    }

    return {
      serverTime: now.toISOString(),
      workDate: today.workDate,
      timezone: boundaries?.timezone ?? today.timezone,
      state,
      canCheckIn: state === "ready_to_check_in",
      canCheckOut: state === "checked_in",
      nonWorkingReason: record ? null : day.reason,
      holiday: day.holiday && { name: day.holiday.name },
      schedule: boundaries && toScheduleBody(boundaries),
      record: record && toAttendance(record, now),
      employee: employee && {
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        fullName: employee.fullName,
      },
      supportContact,
    };
  }

  // Check-in and check-out (§7, §8). Time, employee and status come from the server.

  async checkIn(user: AuthUser, idempotencyKey: string | undefined): Promise<ActionResult> {
    const key = this.parseKey(idempotencyKey);
    const now = this.clock.now();
    const { employee, workDate } = await this.eligibleToday(user, now);

    const result = await this.idempotent(
      user,
      key,
      "attendance_check_in",
      employee.id,
      workDate,
      now,
      async (tx) => {
        if (await this.repo.findForDate(user.organizationId, employee.id, workDate, tx)) {
          throw new AlreadyCheckedInError();
        }
        const day = await this.holidays.isWorkingDay(user.organizationId, workDate, tx);
        if (!day.isWorkingDay || !day.schedule) {
          throw new NotWorkdayError(day.reason ?? "no_schedule", day.holiday?.name ?? null);
        }
        const b = boundariesFor(day.schedule, workDate);
        const window = checkInWindowAt(now, b);
        if (window === "too_early") throw new CheckInTooEarlyError(b.checkInOpensAt);
        if (window === "closed") throw new CheckInWindowClosedError(b.checkInClosesAt);

        const row = await this.repo.insertCheckIn(
          {
            organizationId: user.organizationId,
            employeeId: employee.id,
            workScheduleId: day.schedule.id,
            workDate: toDateColumn(workDate),
            ...statusAtCheckIn(now, b.onTimeDeadlineAt),
            checkInAt: now,
            scheduleTimezone: day.schedule.timezone,
            scheduledStartAt: b.scheduledStartAt,
            scheduledEndAt: b.scheduledEndAt,
            onTimeDeadlineAt: b.onTimeDeadlineAt,
            checkInOpensAt: b.checkInOpensAt,
            checkInClosesAt: b.checkInClosesAt,
            checkOutClosesAt: b.checkOutClosesAt,
          },
          tx,
        );
        // A parallel request with another key won the unique constraint
        if (row === DUPLICATE) throw new AlreadyCheckedInError();
        return { row, status: 201 };
      },
    );

    if (!result.replayed) {
      await this.emit(ATTENDANCE_EVENTS.checkedIn, user, result.body.id, {
        workDate,
        status: result.body.status,
        lateMinutes: result.body.lateMinutes,
      });
    }
    return result;
  }

  async checkOut(user: AuthUser, idempotencyKey: string | undefined): Promise<ActionResult> {
    const key = this.parseKey(idempotencyKey);
    const now = this.clock.now();
    const { employee, workDate } = await this.eligibleToday(user, now);

    const result = await this.idempotent(
      user,
      key,
      "attendance_check_out",
      employee.id,
      workDate,
      now,
      async (tx) => {
        const record = await this.repo.findForDate(user.organizationId, employee.id, workDate, tx);
        if (!record?.checkInAt) {
          // Just after midnight, "check out" means yesterday's open record: its deadline passed
          const yesterday = addDays(workDate, -1);
          const missed = await this.repo.findForDate(
            user.organizationId,
            employee.id,
            yesterday,
            tx,
          );
          if (missed?.completion === "open" && !canCheckOutAt(now, missed.checkOutClosesAt)) {
            throw new CheckOutWindowClosedError(missed.checkOutClosesAt);
          }
          throw new NotCheckedInError();
        }
        if (record.checkOutAt) throw new AlreadyCheckedOutError();
        // The deadline from the record's own snapshot, not today's schedule
        if (!canCheckOutAt(now, record.checkOutClosesAt)) {
          throw new CheckOutWindowClosedError(record.checkOutClosesAt);
        }
        const checkOutAt = now < record.checkInAt ? record.checkInAt : now;
        const row = await this.repo.checkOut(
          record.id,
          record.version,
          { checkOutAt, workedMinutes: workedMinutesBetween(record.checkInAt, checkOutAt) },
          tx,
        );
        // A parallel request checked out first: its timestamp stays
        if (!row) throw new AlreadyCheckedOutError();
        return { row, status: 200 };
      },
    );

    if (!result.replayed) {
      await this.emit(ATTENDANCE_EVENTS.checkedOut, user, result.body.id, {
        workDate,
        workedMinutes: result.body.workedMinutes,
      });
    }
    return result;
  }

  // Own history (§12)

  async listMine(
    user: AuthUser,
    query: ListMyAttendanceQueryInput,
  ): Promise<Paginated<AttendanceResponseBody>> {
    const employee = await this.requireProfile(user);
    const now = this.clock.now();
    const { rows, total } = await this.repo.listOwn(user.organizationId, employee.id, {
      ...query,
      ...(query.incomplete && { incompleteAt: now }),
    });
    return {
      items: rows.map((row) => toAttendance(row, now)),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  /** Counts that reconcile with the history list for the same range (§13). */
  async summaryMine(
    user: AuthUser,
    query: AttendanceSummaryQueryInput,
  ): Promise<AttendanceSummaryBody> {
    const employee = await this.requireProfile(user);
    const now = this.clock.now();
    const from = query.month ? `${query.month}-01` : (query.from as LocalDate);
    const to = query.month ? lastDayOfMonth(query.month) : (query.to as LocalDate);
    const rows = await this.repo.findOwnBetween(user.organizationId, employee.id, from, to);

    const summary: AttendanceSummaryBody = {
      from,
      to,
      records: rows.length,
      present: 0,
      late: 0,
      attended: 0,
      absent: 0,
      excused: 0,
      complete: 0,
      open: 0,
      incomplete: 0,
      workedMinutes: 0,
      lateMinutes: 0,
    };
    for (const row of rows) {
      summary[row.status] += 1;
      summary.lateMinutes += row.lateMinutes;
      if (row.completion === "complete") {
        summary.complete += 1;
        summary.workedMinutes += row.workedMinutes ?? 0;
      } else if (row.completion === "open") {
        summary[isIncomplete(row, now) ? "incomplete" : "open"] += 1;
      }
    }
    summary.attended = summary.present + summary.late;
    return summary;
  }

  /** Own records only for now; team and organization scopes come with those views. */
  async findOne(user: AuthUser, id: string): Promise<AttendanceResponseBody> {
    const employee = await this.employees.findProfileForUser(user.organizationId, user.id);
    const row = employee ? await this.repo.findOwn(user.organizationId, employee.id, id) : null;
    if (!row) throw new NotFoundError("Attendance record");
    return toAttendance(row, this.clock.now());
  }

  // For corrections (DOMAIN_RULES.md §11). Scope checks are the caller's job.

  async findForCorrection(
    organizationId: string,
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<CorrectableAttendance | null> {
    const row = await this.repo.findInOrganization(organizationId, id, tx);
    return (
      row && {
        id: row.id,
        employeeId: row.employeeId,
        workDate: fromDateColumn(row.workDate),
        timezone: row.scheduleTimezone,
        status: row.status,
        checkInAt: row.checkInAt,
        checkOutAt: row.checkOutAt,
        version: row.version,
        pendingCorrectionId: row.pendingCorrection?.id ?? null,
      }
    );
  }

  /**
   * §11.5 (2–6) — sets the approved timestamps and recalculates status, lateness,
   * duration and completion from the record's own schedule snapshot. Null if the
   * record is no longer at `expectedVersion`.
   */
  async applyCorrection(
    organizationId: string,
    id: string,
    expectedVersion: number,
    pair: { checkInAt: Date; checkOutAt: Date | null },
    now: Date,
    tx: Prisma.TransactionClient,
  ): Promise<{ before: AttendanceSnapshot; after: AttendanceSnapshot } | null> {
    const before = await this.repo.findInOrganization(organizationId, id, tx);
    if (!before || before.version !== expectedVersion) return null;
    const after = await this.repo.applyCorrection(
      id,
      expectedVersion,
      {
        ...valuesFor(pair.checkInAt, pair.checkOutAt, before.onTimeDeadlineAt),
        checkInAt: pair.checkInAt,
        checkOutAt: pair.checkOutAt,
        correctedAt: before.correctedAt ?? now,
      },
      tx,
    );
    return after && { before: snapshotFields(before), after: snapshotFields(after) };
  }

  // Helpers

  private parseKey(value: string | undefined): string {
    if (!value || !IDEMPOTENCY_KEY_PATTERN.test(value)) throw new IdempotencyKeyRequiredError();
    return hashToken(value);
  }

  private async requireProfile(user: AuthUser): Promise<EmployeeProfile> {
    const employee = await this.employees.findProfileForUser(user.organizationId, user.id);
    if (!employee) throw new EmployeeProfileRequiredError();
    return employee;
  }

  /** §7.1 (1–3) — an active profile, employed on today's work date. */
  private async eligibleToday(
    user: AuthUser,
    now: Date,
  ): Promise<{ employee: EmployeeProfile; workDate: LocalDate }> {
    const employee = await this.requireProfile(user);
    const { workDate } = await this.workSettings.today(user.organizationId, now);
    if (!isEligibleOn(employee, workDate)) throw new EmployeeInactiveError();
    return { employee, workDate };
  }

  /**
   * §7.4 — runs `work` once per Idempotency-Key. The key is claimed in the same
   * transaction, so a retry waits for the first attempt and then gets its stored
   * result. A failed attempt rolls back and frees the key for a fresh evaluation
   * (e.g. a retry at 08:00 after CHECK_IN_TOO_EARLY at 07:59).
   */
  private async idempotent(
    user: AuthUser,
    key: string,
    action: IdempotencyAction,
    employeeId: string,
    workDate: LocalDate,
    now: Date,
    work: (tx: Prisma.TransactionClient) => Promise<{ row: AttendanceRow; status: number }>,
  ): Promise<ActionResult> {
    const requestHash = createHash("sha256")
      .update(JSON.stringify([action, employeeId, workDate]))
      .digest("hex");
    const claim = { organizationId: user.organizationId, userId: user.id, key };

    return this.prisma.$transaction(async (tx) => {
      const existing = await this.idempotency.claim(
        {
          ...claim,
          action,
          requestHash,
          lockedAt: now,
          expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
        },
        tx,
      );
      if (existing) {
        if (existing.requestHash !== requestHash || !existing.completedAt) {
          throw new IdempotencyKeyReusedError();
        }
        return { body: existing.responseBody as AttendanceResponseBody, replayed: true };
      }

      const { row, status } = await work(tx);
      const body = toAttendance(row, now);
      await this.idempotency.complete(
        claim,
        { attendanceId: row.id, responseStatus: status, responseBody: body },
        now,
        tx,
      );
      return { body, replayed: false };
    });
  }

  private async emit(
    name: AttendanceEventName,
    actor: AuthUser,
    targetId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.events.emitAsync(
      name,
      new AttendanceEvent(name, actor.organizationId, actor.id, targetId, metadata),
    );
  }
}
