import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";

import { UserDirectory } from "@/common/contracts/directory.js";
import type { Paginated } from "@/common/dto/pagination.js";
import { NotFoundError } from "@/common/errors/app-error.js";
import { addDays, fromDateColumn, toDateColumn, type LocalDate } from "@/common/time/zoned-time.js";
import type { AuthUser } from "@/common/types/auth.js";
import { PrismaService } from "@/infra/attendance-db/prisma.service.js";
import type { Tx } from "@/infra/attendance-db/prisma.types.js";
import { Clock } from "@/infra/clock/clock.js";
import type { CreateHolidayInput } from "@/modules/holidays/dto/create-holiday.dto.js";
import type {
  CalendarDayBody,
  HolidayResponseBody,
} from "@/modules/holidays/dto/holiday.response.js";
import type { ListHolidaysQueryInput } from "@/modules/holidays/dto/list-holidays.query.js";
import type { UpdateHolidayInput } from "@/modules/holidays/dto/update-holiday.dto.js";
import type { WorkCalendarQueryInput } from "@/modules/holidays/dto/work-calendar.query.js";
import { HolidayDateConflictError } from "@/modules/holidays/holidays.errors.js";
import {
  HOLIDAY_EVENTS,
  HolidayEvent,
  type HolidayEventName,
} from "@/modules/holidays/holidays.events.js";
import { HolidaysRepository, type HolidayRow } from "@/modules/holidays/holidays.repository.js";
import { isScheduledWeekday } from "@/modules/work-settings/domain/schedule-policy.js";
import {
  covers,
  WorkSettingsService,
  type ScheduleVersion,
} from "@/modules/work-settings/work-settings.service.js";

/** Whether a date is a working day, and why not (DOMAIN_RULES.md §6.3). */
export type WorkingDay = {
  date: LocalDate;
  isWorkingDay: boolean;
  reason: CalendarDayBody["reason"];
  holiday: { id: string; name: string } | null;
  schedule: ScheduleVersion | null;
};

const toHoliday = (row: HolidayRow): HolidayResponseBody => ({
  id: row.id,
  date: fromDateColumn(row.date),
  name: row.name,
  createdBy: { id: row.createdById, name: row.createdByName },
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const workingDay = (
  date: LocalDate,
  schedule: ScheduleVersion | null,
  holiday: { id: string; name: string } | null,
): WorkingDay => {
  const reason = !schedule
    ? "no_schedule"
    : !isScheduledWeekday(schedule, date)
      ? "non_working_day"
      : holiday
        ? "holiday"
        : null;
  return { date, isWorkingDay: reason === null, reason, holiday, schedule };
};

@Injectable()
export class HolidaysService {
  constructor(
    private readonly repo: HolidaysRepository,
    private readonly prisma: PrismaService,
    private readonly workSettings: WorkSettingsService,
    private readonly clock: Clock,
    private readonly events: EventEmitter2,
    private readonly users: UserDirectory,
  ) {}

  async list(
    user: AuthUser,
    query: ListHolidaysQueryInput,
  ): Promise<Paginated<HolidayResponseBody>> {
    const { rows, total } = await this.repo.list(user.organizationId, query);
    return { items: rows.map(toHoliday), page: query.page, pageSize: query.pageSize, total };
  }

  async findOne(user: AuthUser, id: string): Promise<HolidayResponseBody> {
    return toHoliday(await this.load(user.organizationId, id));
  }

  /**
   * Past dates are allowed: the change is audited, existing attendance stays as it is,
   * and close-day doesn't reprocess closed dates (§6.3).
   */
  async create(user: AuthUser, input: CreateHolidayInput): Promise<HolidayResponseBody> {
    const names = await this.users.namesByIds(user.organizationId, [user.id]);
    const created = await this.prisma.$transaction(async (tx) => {
      await this.repo.lockHolidays(user.organizationId, tx);
      if (await this.repo.findOnDate(user.organizationId, input.date, undefined, tx)) {
        throw new HolidayDateConflictError();
      }
      return this.repo.insert(
        {
          organizationId: user.organizationId,
          createdById: user.id,
          createdByName: names.get(user.id) ?? "",
          date: toDateColumn(input.date),
          name: input.name,
        },
        tx,
      );
    });
    const holiday = toHoliday(created);
    await this.emit(HOLIDAY_EVENTS.created, user, holiday.id, {
      date: holiday.date,
      past: await this.isPast(user.organizationId, holiday.date),
    });
    return holiday;
  }

  async update(
    user: AuthUser,
    id: string,
    input: UpdateHolidayInput,
  ): Promise<HolidayResponseBody> {
    const target = toHoliday(await this.load(user.organizationId, id));
    const dateChanges = input.date !== undefined && input.date !== target.date;
    const updated = await this.prisma.$transaction(async (tx) => {
      if (dateChanges && input.date) {
        await this.repo.lockHolidays(user.organizationId, tx);
        if (await this.repo.findOnDate(user.organizationId, input.date, id, tx)) {
          throw new HolidayDateConflictError();
        }
      }
      return this.repo.update(
        id,
        {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.date && { date: toDateColumn(input.date) }),
        },
        tx,
      );
    });
    const holiday = toHoliday(updated);
    await this.emit(HOLIDAY_EVENTS.updated, user, id, {
      fields: Object.keys(input),
      ...(dateChanges && { dateFrom: target.date, dateTo: holiday.date }),
    });
    return holiday;
  }

  /** Soft delete: the date becomes a working day again (if the schedule says so). */
  async remove(user: AuthUser, id: string): Promise<void> {
    const target = toHoliday(await this.load(user.organizationId, id));
    await this.repo.softDelete(id, this.clock.now());
    await this.emit(HOLIDAY_EVENTS.deleted, user, id, { date: target.date });
  }

  // Working days (used by attendance)

  /** Schedule in force, its weekdays, and active holidays decide (§6.3). */
  async isWorkingDay(organizationId: string, date: LocalDate, tx?: Tx): Promise<WorkingDay> {
    const [schedule, holiday] = await Promise.all([
      this.workSettings.scheduleOn(organizationId, date, tx),
      this.repo.findOnDate(organizationId, date, undefined, tx),
    ]);
    return workingDay(date, schedule, holiday && { id: holiday.id, name: holiday.name });
  }

  async calendar(
    user: AuthUser,
    query: WorkCalendarQueryInput,
  ): Promise<{ items: CalendarDayBody[] }> {
    const days = await this.workingDaysBetween(user.organizationId, query.from, query.to);
    return {
      items: days.map(({ schedule, ...day }) => ({ ...day, scheduleId: schedule?.id ?? null })),
    };
  }

  /** Every date in the range (inclusive) and whether it's a working day (for reports). */
  async workingDaysBetween(
    organizationId: string,
    from: LocalDate,
    to: LocalDate,
  ): Promise<WorkingDay[]> {
    const [rows, schedules] = await Promise.all([
      this.repo.findBetween(organizationId, from, to),
      this.workSettings.schedulesBetween(organizationId, from, to),
    ]);
    const holidays = new Map(rows.map((h) => [fromDateColumn(h.date), { id: h.id, name: h.name }]));
    const days: WorkingDay[] = [];
    for (let date = from; date <= to; date = addDays(date, 1)) {
      const schedule = schedules.find((version) => covers(version, date)) ?? null;
      days.push(workingDay(date, schedule, holidays.get(date) ?? null));
    }
    return days;
  }

  // Helpers

  /** 404 for a holiday in another organization (docs/09-authorization.md). */
  private async load(organizationId: string, id: string): Promise<HolidayRow> {
    const holiday = await this.repo.findInOrganization(organizationId, id);
    if (!holiday) throw new NotFoundError("Holiday");
    return holiday;
  }

  private async isPast(organizationId: string, date: LocalDate): Promise<boolean> {
    const today = await this.workSettings.today(organizationId, this.clock.now());
    return date < today.workDate;
  }

  private async emit(
    name: HolidayEventName,
    actor: AuthUser,
    targetId: string,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    await this.events.emitAsync(
      name,
      new HolidayEvent(name, actor.organizationId, actor.id, targetId, metadata),
    );
  }
}
