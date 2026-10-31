import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";

import type { Paginated } from "@/common/dto/pagination.js";
import { ForbiddenError } from "@/common/errors/app-error.js";
import { addDays, formatZoned, type LocalDate } from "@/common/time/zoned-time.js";
import type { AuthUser, Permission } from "@/common/types/auth.js";
import { Clock } from "@/infra/clock/clock.js";
import { toAttendance } from "@/modules/attendance/attendance.mapper.js";
import { isIncomplete } from "@/modules/attendance/domain/attendance-calculator.js";
import { EmployeeProfileRequiredError } from "@/modules/employees/employees.errors.js";
import { EmployeesService } from "@/modules/employees/employees.service.js";
import { HolidaysService } from "@/modules/holidays/holidays.service.js";
import { CSV_BOM, csvLine } from "@/modules/reports/domain/csv.js";
import type {
  DashboardQueryInput,
  ReportExportQueryInput,
  ReportQueryInput,
  TeamDayQueryInput,
  TeamHistoryQueryInput,
  TrendsQueryInput,
} from "@/modules/reports/dto/report.query.js";
import type {
  OrganizationDashboardBody,
  ReportRecordBody,
  ReportResponseBody,
  TeamDayResponseBody,
  TrendPointBody,
} from "@/modules/reports/dto/report.response.js";
import {
  CSV_BATCH_SIZE,
  DASHBOARD_TREND_WORKING_DAYS,
  TEAM_HISTORY_DAYS,
  type TeamDayState,
} from "@/modules/reports/reports.constants.js";
import { QueryOutOfRangeError } from "@/modules/reports/reports.errors.js";
import { REPORT_EVENTS, ReportExportEvent } from "@/modules/reports/reports.events.js";
import {
  ReportsRepository,
  type RecordFilter,
  type ReportRow,
} from "@/modules/reports/reports.repository.js";
import { boundariesFor } from "@/modules/work-settings/domain/schedule-policy.js";
import { WorkSettingsService } from "@/modules/work-settings/work-settings.service.js";

/** Whose records the caller may read: everyone in the organization, or these employees. */
type Scope = { employeeIds?: string[] };

const toRecord = (row: ReportRow, now: Date): ReportRecordBody => ({
  ...toAttendance(row, now),
  employee: row.employee,
});

/** CSV columns (DOMAIN_RULES.md §13.1); times are shown in the record's own zone. */
const CSV_HEADER = [
  "workDate",
  "employeeNumber",
  "employeeName",
  "divisionName",
  "timezone",
  "scheduledStart",
  "scheduledEnd",
  "checkInAt",
  "checkOutAt",
  "attendanceStatus",
  "lateMinutes",
  "workedMinutes",
  "completionStatus",
  "corrected",
  "note",
];

const csvRow = (row: ReportRow, now: Date) => {
  const tz = row.scheduleTimezone;
  const zoned = (instant: Date | null) => (instant ? formatZoned(instant, tz) : null);
  const notes = [
    ...(isIncomplete(row, now) ? ["Missing check-out"] : []),
    ...(row.correctedAt ? ["Corrected"] : []),
    ...(row.pendingCorrection ? ["Correction pending"] : []),
  ];
  return csvLine([
    row.workDate.toISOString().slice(0, 10),
    row.employee.employeeNumber,
    row.employee.fullName,
    row.employee.division.name,
    tz,
    zoned(row.scheduledStartAt),
    zoned(row.scheduledEndAt),
    zoned(row.checkInAt),
    zoned(row.checkOutAt),
    row.status,
    row.lateMinutes,
    row.workedMinutes,
    isIncomplete(row, now) ? "incomplete" : row.completion,
    row.correctedAt !== null,
    notes.join("; ") || null,
  ]);
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly repo: ReportsRepository,
    private readonly employees: EmployeesService,
    private readonly holidays: HolidaysService,
    private readonly workSettings: WorkSettingsService,
    private readonly clock: Clock,
    private readonly events: EventEmitter2,
  ) {}

  // Team (attendance:read_team) — the caller's active direct reports, last 90 days

  async teamDay(user: AuthUser, query: TeamDayQueryInput): Promise<TeamDayResponseBody> {
    const now = this.clock.now();
    const [team, today] = await Promise.all([
      this.requireTeam(user),
      this.workSettings.today(user.organizationId, now),
    ]);
    const date = query.date ?? today.workDate;
    this.assertTeamRange({ date }, today.workDate);

    const [day, employees] = await Promise.all([
      this.holidays.isWorkingDay(user.organizationId, date),
      this.repo.employeesOnDay(
        { organizationId: user.organizationId, employeeIds: team.employeeIds },
        date,
      ),
    ]);
    const summary = {
      employees: employees.length,
      present: 0,
      late: 0,
      notCheckedIn: 0,
      notCheckedOut: 0,
      absent: 0,
    };
    const items = employees.map(({ attendances, ...employee }) => {
      const record = attendances[0] ?? null;
      let state: TeamDayState;
      if (!record) state = day.isWorkingDay ? "not_checked_in" : "non_working_day";
      else if (record.status === "absent" || record.status === "excused") state = record.status;
      else if (record.checkOutAt) state = "checked_out";
      else state = now > record.scheduledEndAt ? "not_checked_out" : "checked_in";

      if (record?.status === "present" || record?.status === "late") summary[record.status] += 1;
      if (state === "not_checked_in") summary.notCheckedIn += 1;
      if (state === "not_checked_out") summary.notCheckedOut += 1;
      if (state === "absent") summary.absent += 1;
      return { employee, state, record: record && toAttendance(record, now) };
    });

    return {
      serverTime: now.toISOString(),
      workDate: date,
      timezone: day.schedule?.timezone ?? today.timezone,
      isWorkingDay: day.isWorkingDay,
      nonWorkingReason: day.reason,
      summary,
      items,
    };
  }

  async teamHistory(
    user: AuthUser,
    query: TeamHistoryQueryInput,
  ): Promise<Paginated<ReportRecordBody>> {
    const now = this.clock.now();
    const [team, today] = await Promise.all([
      this.requireTeam(user),
      this.workSettings.today(user.organizationId, now),
    ]);
    const from = query.from ?? addDays(today.workDate, -(TEAM_HISTORY_DAYS - 1));
    const to = query.to ?? today.workDate;
    this.assertTeamRange({ from, to }, today.workDate);
    const { rows, total } = await this.repo.listRecords(
      { ...query, organizationId: user.organizationId, from, to, employeeIds: team.employeeIds },
      query,
      now,
    );
    return {
      items: rows.map((row) => toRecord(row, now)),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  // Organization dashboard (attendance:read_all)

  async organizationDashboard(
    user: AuthUser,
    query: DashboardQueryInput,
  ): Promise<OrganizationDashboardBody> {
    const now = this.clock.now();
    const today = await this.workSettings.today(user.organizationId, now);
    const date = today.workDate;
    const filter = { organizationId: user.organizationId, ...query };
    const dayFilter: RecordFilter = { ...filter, from: date, to: date };

    const [day, counts, eligible, notCheckedOut, pendingCorrections, trend] = await Promise.all([
      this.holidays.isWorkingDay(user.organizationId, date),
      this.repo.summarize(dayFilter, now),
      this.repo.eligibleCounts(filter, date),
      this.repo.countNotCheckedOut(dayFilter, now),
      this.repo.countPendingCorrections(filter),
      this.recentTrend(filter, date, now),
    ]);
    return {
      serverTime: now.toISOString(),
      workDate: date,
      timezone: day.schedule?.timezone ?? today.timezone,
      isWorkingDay: day.isWorkingDay,
      nonWorkingReason: day.reason,
      checkInWindowClosed:
        day.schedule !== null && now > boundariesFor(day.schedule, date).checkInClosesAt,
      activeEmployees: eligible.eligible,
      present: counts.present,
      late: counts.late,
      absent: counts.absent,
      notCheckedIn: day.isWorkingDay ? eligible.withoutRecord : 0,
      notCheckedOut,
      pendingCorrections,
      trend,
    };
  }

  // Reports (report:read_team / report:read_all)

  async report(user: AuthUser, query: ReportQueryInput): Promise<ReportResponseBody> {
    const now = this.clock.now();
    const filter = await this.recordFilter(user, query);
    const [{ rows, total }, summary] = await Promise.all([
      this.repo.listRecords(filter, query, now),
      this.repo.summarize(filter, now),
    ]);
    return {
      items: rows.map((row) => toRecord(row, now)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      summary: {
        from: query.from,
        to: query.to,
        ...summary,
        attended: summary.present + summary.late,
      },
    };
  }

  async trends(
    user: AuthUser,
    query: TrendsQueryInput,
  ): Promise<{ from: LocalDate; to: LocalDate; items: TrendPointBody[] }> {
    const now = this.clock.now();
    const filter = await this.recordFilter(user, query);
    const [days, counts] = await Promise.all([
      this.holidays.workingDaysBetween(user.organizationId, query.from, query.to),
      this.repo.dailyCounts(filter, now),
    ]);
    return {
      from: query.from,
      to: query.to,
      items: days.map((day) => ({
        date: day.date,
        isWorkingDay: day.isWorkingDay,
        ...(counts.get(day.date) ?? { present: 0, late: 0, absent: 0, incomplete: 0 }),
      })),
    };
  }

  /**
   * The full filtered report as CSV chunks (report:read_all), in the report's order.
   * Audited once the last row is out.
   */
  async *exportCsv(user: AuthUser, query: ReportExportQueryInput): AsyncGenerator<string> {
    const now = this.clock.now();
    const filter = await this.recordFilter(user, query);
    yield CSV_BOM + csvLine(CSV_HEADER);
    let rows = 0;
    for (let page = 1; ; page += 1) {
      const batch = await this.repo.listRecords(filter, { page, pageSize: CSV_BATCH_SIZE }, now);
      if (batch.rows.length > 0) yield batch.rows.map((row) => csvRow(row, now)).join("");
      rows += batch.rows.length;
      if (batch.rows.length < CSV_BATCH_SIZE) break;
    }
    await this.events.emitAsync(
      REPORT_EVENTS.exported,
      new ReportExportEvent(user.organizationId, user.id, {
        report: "attendance",
        format: "csv",
        rows,
        filters: { ...query },
      }),
    );
  }

  // Helpers

  /** A manager's team; a caller without an active profile has none. */
  private async requireTeam(user: AuthUser): Promise<{ employeeIds: string[] }> {
    const team = await this.employees.teamOf(user.organizationId, user.id);
    if (!team) throw new EmployeeProfileRequiredError();
    return team;
  }

  /** §12 — managers read the last 90 days, nothing after today. */
  private assertTeamRange(
    dates: { date?: LocalDate; from?: LocalDate; to?: LocalDate },
    today: LocalDate,
  ) {
    const earliest = addDays(today, -(TEAM_HISTORY_DAYS - 1));
    const errors: Record<string, string[]> = {};
    for (const [field, value] of Object.entries(dates)) {
      if (value === undefined) continue;
      if (value < earliest) errors[field] = [`Team history starts on ${earliest}`];
      else if (value > today) errors[field] = [`Use a date up to ${today}`];
    }
    if (Object.keys(errors).length > 0) throw new QueryOutOfRangeError(errors);
  }

  /** The caller's report scope applied to the query (§13: managers see direct reports). */
  private async recordFilter(
    user: AuthUser,
    query: Omit<RecordFilter, "organizationId">,
  ): Promise<RecordFilter> {
    const scope = await this.reportScope(user);
    return {
      organizationId: user.organizationId,
      from: query.from,
      to: query.to,
      employeeId: query.employeeId,
      divisionId: query.divisionId,
      status: query.status,
      completion: query.completion,
      ...scope,
    };
  }

  private async reportScope(user: AuthUser): Promise<Scope> {
    const has = (permission: Permission) => user.permissions.includes(permission);
    if (has("report:read_all")) return {};
    if (!has("report:read_team")) throw new ForbiddenError();
    const team = await this.employees.teamOf(user.organizationId, user.id);
    return { employeeIds: team?.employeeIds ?? [] };
  }

  /** The dashboard trend: the last 30 working days ending `today` (looking back up to 90). */
  private async recentTrend(
    filter: { organizationId: string; employeeId?: string; divisionId?: string },
    today: LocalDate,
    now: Date,
  ): Promise<TrendPointBody[]> {
    const days = (
      await this.holidays.workingDaysBetween(filter.organizationId, addDays(today, -89), today)
    )
      .filter((day) => day.isWorkingDay)
      .slice(-DASHBOARD_TREND_WORKING_DAYS);
    const first = days[0];
    if (!first) return [];
    const counts = await this.repo.dailyCounts({ ...filter, from: first.date, to: today }, now);
    return days.map((day) => ({
      date: day.date,
      isWorkingDay: true,
      ...(counts.get(day.date) ?? { present: 0, late: 0, absent: 0, incomplete: 0 }),
    }));
  }
}
