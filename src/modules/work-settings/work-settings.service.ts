import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";

import type { Paginated, PaginationQuery } from "@/common/dto/pagination.js";
import { NotFoundError } from "@/common/errors/app-error.js";
import {
  addDays,
  formatTimeOfDay,
  fromDateColumn,
  fromTimeColumn,
  localDateOf,
  toDateColumn,
  toTimeColumn,
  type LocalDate,
} from "@/common/time/zoned-time.js";
import type { AuthUser } from "@/common/types/auth.js";
import { Clock } from "@/infra/clock/clock.js";
import { PrismaService } from "@/infra/prisma/prisma.service.js";
import type { Tx } from "@/infra/prisma/prisma.types.js";
import {
  boundariesFor,
  isScheduledWeekday,
  onTimeDeadlineOf,
  type SchedulePolicy,
} from "@/modules/work-settings/domain/schedule-policy.js";
import type { CreateWorkScheduleInput } from "@/modules/work-settings/dto/create-work-schedule.dto.js";
import type { UpdateWorkSettingsInput } from "@/modules/work-settings/dto/update-work-settings.dto.js";
import type {
  ScheduleBoundariesBody,
  WorkScheduleResponseBody,
} from "@/modules/work-settings/dto/work-schedule.response.js";
import type { WorkSettingsResponseBody } from "@/modules/work-settings/dto/work-settings.response.js";
import {
  PREVIEW_DAYS,
  type ScheduleState,
} from "@/modules/work-settings/work-settings.constants.js";
import {
  ScheduleEffectiveDateTooEarlyError,
  SchedulePeriodOverlapError,
} from "@/modules/work-settings/work-settings.errors.js";
import {
  OrganizationSettingsEvent,
  WorkScheduleEvent,
} from "@/modules/work-settings/work-settings.events.js";
import {
  DUPLICATE,
  WorkSettingsRepository,
  type ScheduleRow,
} from "@/modules/work-settings/work-settings.repository.js";

/** A schedule version as the rest of the app uses it (times in ms since local midnight). */
export type ScheduleVersion = SchedulePolicy & {
  id: string;
  name: string;
  effectiveFrom: LocalDate;
  effectiveTo: LocalDate | null;
  createdBy: { id: string; name: string };
  createdAt: Date;
};

/** Today in the organization: the work date and the version in force on it. */
export type Today = { workDate: LocalDate; timezone: string; schedule: ScheduleVersion | null };

const toVersion = (row: ScheduleRow): ScheduleVersion => ({
  id: row.id,
  name: row.name,
  timezone: row.timezone,
  workingDays: row.workingDays,
  startTime: fromTimeColumn(row.startTime),
  endTime: fromTimeColumn(row.endTime),
  toleranceMinutes: row.toleranceMinutes,
  checkInOpensAt: fromTimeColumn(row.checkInOpensAt),
  checkInClosesAt: fromTimeColumn(row.checkInClosesAt),
  checkOutDeadline: fromTimeColumn(row.checkOutDeadline),
  effectiveFrom: fromDateColumn(row.effectiveFrom),
  effectiveTo: row.effectiveTo ? fromDateColumn(row.effectiveTo) : null,
  createdBy: row.createdBy,
  createdAt: row.createdAt,
});

export const covers = (
  version: Pick<ScheduleVersion, "effectiveFrom" | "effectiveTo">,
  date: LocalDate,
) => version.effectiveFrom <= date && (version.effectiveTo === null || date <= version.effectiveTo);

const stateOf = (version: ScheduleVersion, today: LocalDate): ScheduleState =>
  version.effectiveTo !== null && version.effectiveTo < today
    ? "past"
    : version.effectiveFrom > today
      ? "upcoming"
      : "current";

const toSchedule = (version: ScheduleVersion, today: LocalDate): WorkScheduleResponseBody => ({
  id: version.id,
  name: version.name,
  scope: "organization",
  timezone: version.timezone,
  workingDays: version.workingDays,
  startTime: formatTimeOfDay(version.startTime),
  endTime: formatTimeOfDay(version.endTime),
  toleranceMinutes: version.toleranceMinutes,
  onTimeDeadline: formatTimeOfDay(onTimeDeadlineOf(version)),
  checkInOpensAt: formatTimeOfDay(version.checkInOpensAt),
  checkInClosesAt: formatTimeOfDay(version.checkInClosesAt),
  checkOutDeadline: formatTimeOfDay(version.checkOutDeadline, "milliseconds"),
  effectiveFrom: version.effectiveFrom,
  effectiveTo: version.effectiveTo,
  state: stateOf(version, today),
  createdBy: version.createdBy,
  createdAt: version.createdAt.toISOString(),
});

export const toBoundaries = (
  policy: SchedulePolicy,
  workDate: LocalDate,
): ScheduleBoundariesBody => {
  const b = boundariesFor(policy, workDate);
  return {
    workDate,
    isScheduledWeekday: isScheduledWeekday(policy, workDate),
    checkInOpensAt: b.checkInOpensAt.toISOString(),
    scheduledStartAt: b.scheduledStartAt.toISOString(),
    onTimeDeadlineAt: b.onTimeDeadlineAt.toISOString(),
    scheduledEndAt: b.scheduledEndAt.toISOString(),
    checkInClosesAt: b.checkInClosesAt.toISOString(),
    checkOutClosesAt: b.checkOutClosesAt.toISOString(),
  };
};

@Injectable()
export class WorkSettingsService {
  constructor(
    private readonly repo: WorkSettingsRepository,
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly events: EventEmitter2,
  ) {}

  // Organization settings (policy:manage)

  async getSettings(user: AuthUser): Promise<WorkSettingsResponseBody> {
    const settings = await this.repo.findSettings(user.organizationId);
    const today = await this.today(user.organizationId, this.clock.now());
    return {
      timezone: today.timezone,
      supportContact: settings.supportContact,
      retentionYears: settings.retentionYears,
      workDate: today.workDate,
      earliestEffectiveFrom: addDays(today.workDate, 1),
      currentSchedule: today.schedule && toSchedule(today.schedule, today.workDate),
    };
  }

  async updateSettings(
    user: AuthUser,
    input: UpdateWorkSettingsInput,
  ): Promise<WorkSettingsResponseBody> {
    const before = await this.repo.findSettings(user.organizationId);
    await this.repo.updateSettings(user.organizationId, input);
    await this.events.emitAsync(
      "organization.settings_updated",
      new OrganizationSettingsEvent(user.organizationId, user.id, {
        fields: Object.keys(input),
        ...(input.retentionYears !== undefined && {
          retentionYearsFrom: before.retentionYears,
          retentionYearsTo: input.retentionYears,
        }),
      }),
    );
    return this.getSettings(user);
  }

  // Schedule versions (policy:manage)

  async listSchedules(
    user: AuthUser,
    query: PaginationQuery,
  ): Promise<Paginated<WorkScheduleResponseBody>> {
    const [{ rows, total }, today] = await Promise.all([
      this.repo.listSchedules(user.organizationId, query),
      this.today(user.organizationId, this.clock.now()),
    ]);
    return {
      items: rows.map((row) => toSchedule(toVersion(row), today.workDate)),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async findSchedule(user: AuthUser, id: string): Promise<WorkScheduleResponseBody> {
    const row = await this.repo.findSchedule(user.organizationId, id);
    if (!row) throw new NotFoundError("Schedule");
    const today = await this.today(user.organizationId, this.clock.now());
    return toSchedule(toVersion(row), today.workDate);
  }

  /** What the version would mean, day by day, without saving it. */
  async previewSchedule(
    user: AuthUser,
    input: CreateWorkScheduleInput,
  ): Promise<{ onTimeDeadline: string; days: ScheduleBoundariesBody[] }> {
    const today = await this.today(user.organizationId, this.clock.now());
    this.assertEffectiveFrom(input.effectiveFrom, today);
    return {
      onTimeDeadline: formatTimeOfDay(onTimeDeadlineOf(input)),
      days: Array.from({ length: PREVIEW_DAYS }, (_, i) =>
        toBoundaries(input, addDays(input.effectiveFrom, i)),
      ),
    };
  }

  /**
   * Adds a version from `effectiveFrom` onwards and closes the one in force before it
   * (DATA_MODEL.md §6.3). Under a per-organization lock, so parallel requests can't
   * both pass the overlap check.
   */
  async createSchedule(
    user: AuthUser,
    input: CreateWorkScheduleInput,
  ): Promise<WorkScheduleResponseBody> {
    const now = this.clock.now();
    const { created, closedId, today } = await this.prisma.$transaction(async (tx) => {
      await this.repo.lockSchedules(user.organizationId, tx);
      const today = await this.today(user.organizationId, now, tx);
      this.assertEffectiveFrom(input.effectiveFrom, today);

      const inForce = (
        await this.repo.findInForce(user.organizationId, input.effectiveFrom, null, tx)
      ).map(toVersion);
      // A version already starting on or after the new date would overlap it
      const later = inForce.find((version) => version.effectiveFrom >= input.effectiveFrom);
      if (later) throw new SchedulePeriodOverlapError(later.id);
      // Anything else in force is the open-ended current version: it ends the day before
      for (const version of inForce) {
        if (version.effectiveTo !== null) throw new SchedulePeriodOverlapError(version.id);
        await this.repo.closeSchedule(version.id, addDays(input.effectiveFrom, -1), tx);
      }

      const created = await this.repo.insertSchedule(
        {
          organizationId: user.organizationId,
          createdById: user.id,
          name: input.name,
          timezone: input.timezone,
          workingDays: input.workingDays,
          startTime: toTimeColumn(input.startTime),
          endTime: toTimeColumn(input.endTime),
          toleranceMinutes: input.toleranceMinutes,
          checkInOpensAt: toTimeColumn(input.checkInOpensAt),
          checkInClosesAt: toTimeColumn(input.checkInClosesAt),
          checkOutDeadline: toTimeColumn(input.checkOutDeadline),
          effectiveFrom: toDateColumn(input.effectiveFrom),
        },
        tx,
      );
      if (created === DUPLICATE) throw new SchedulePeriodOverlapError();
      return { created: toVersion(created), closedId: inForce[0]?.id ?? null, today };
    });

    await this.events.emitAsync(
      "work_schedule.created",
      new WorkScheduleEvent(user.organizationId, user.id, created.id, {
        effectiveFrom: created.effectiveFrom,
        timezone: created.timezone,
        previousScheduleId: closedId,
      }),
    );
    return toSchedule(created, today.workDate);
  }

  // Used by holidays and attendance

  async supportContactOf(organizationId: string): Promise<string | null> {
    return (await this.repo.findSettings(organizationId)).supportContact;
  }

  /** Every version in force on some day from `from` to `to`, newest first. */
  async schedulesBetween(
    organizationId: string,
    from: LocalDate,
    to: LocalDate,
    tx?: Tx,
  ): Promise<ScheduleVersion[]> {
    return (await this.repo.findInForce(organizationId, from, to, tx)).map(toVersion);
  }

  /** The version in force on a work date, or null if none. */
  async scheduleOn(
    organizationId: string,
    date: LocalDate,
    tx?: Tx,
  ): Promise<ScheduleVersion | null> {
    const [row] = await this.repo.findInForce(organizationId, date, date, tx);
    return row ? toVersion(row) : null;
  }

  /**
   * DOMAIN_RULES.md §5.2 — today's work date is the local date of `now` in the zone of
   * the schedule in force on it. Around a time zone change both neighbours are tried,
   * newest first. Before any schedule exists, the organization's default zone is used.
   */
  async today(organizationId: string, now: Date, tx?: Tx): Promise<Today> {
    const utcDate = now.toISOString().slice(0, 10);
    const candidates = await this.repo.findInForce(
      organizationId,
      addDays(utcDate, -1),
      addDays(utcDate, 1),
      tx,
    );
    for (const version of candidates.map(toVersion)) {
      const workDate = localDateOf(now, version.timezone);
      if (covers(version, workDate))
        return { workDate, timezone: version.timezone, schedule: version };
    }
    const { timezone } = await this.repo.findSettings(organizationId, tx);
    return { workDate: localDateOf(now, timezone), timezone, schedule: null };
  }

  // Helpers

  /** §6.2 — no earlier than the next work date. */
  private assertEffectiveFrom(effectiveFrom: LocalDate, today: Today): void {
    const earliest = addDays(today.workDate, 1);
    if (effectiveFrom < earliest) throw new ScheduleEffectiveDateTooEarlyError(earliest);
  }
}
