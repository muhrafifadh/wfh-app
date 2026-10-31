import { Injectable } from "@nestjs/common";

import { pageWindow, type PaginationQuery } from "@/common/dto/pagination.js";
import { toDateColumn, type LocalDate } from "@/common/time/zoned-time.js";
import type { AttendanceStatus, Prisma } from "@/generated/prisma/client.js";
import { PrismaService } from "@/infra/prisma/prisma.service.js";
import type { Tx } from "@/infra/prisma/prisma.types.js";
import { notDeleted } from "@/infra/prisma/soft-delete.js";
import { attendanceRow } from "@/modules/attendance/attendance.mapper.js";
import type { ReportCompletion } from "@/modules/reports/reports.constants.js";

// ARCHITECTURE.md §6.7 — read-only queries across attendance, employees and corrections
// for dashboards and reports. Never a write path: changes go through the owning modules.

const employeeOfRow = {
  id: true,
  employeeNumber: true,
  fullName: true,
  division: { select: { id: true, code: true, name: true } },
} satisfies Prisma.EmployeeSelect;

const reportRow = {
  ...attendanceRow,
  employee: { select: employeeOfRow },
} satisfies Prisma.AttendanceSelect;

export type ReportRow = Prisma.AttendanceGetPayload<{ select: typeof reportRow }>;

/** Who and what a report covers. `employeeIds` is the caller's scope (a manager's team). */
export type RecordFilter = {
  organizationId: string;
  from: LocalDate;
  to: LocalDate;
  employeeIds?: string[];
  employeeId?: string;
  divisionId?: string;
  status?: AttendanceStatus;
  completion?: ReportCompletion;
};

export type EmployeeFilter = {
  organizationId: string;
  employeeIds?: string[];
  employeeId?: string;
  divisionId?: string;
};

export type SummaryCounts = {
  records: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  complete: number;
  open: number;
  incomplete: number;
  workedMinutes: number;
  lateMinutes: number;
  corrected: number;
};

export type DailyCounts = { present: number; late: number; absent: number; incomplete: number };

/** Open past the check-out deadline at `now` (attendance-calculator isIncomplete). */
const incompleteAt = (now: Date): Prisma.AttendanceWhereInput => ({
  completion: "open",
  checkOutClosesAt: { lt: now },
});

const completionWhere = (completion: ReportCompletion, now: Date): Prisma.AttendanceWhereInput =>
  completion === "incomplete"
    ? incompleteAt(now)
    : completion === "open"
      ? { completion: "open", checkOutClosesAt: { gte: now } }
      : { completion };

const employeeWhere = (
  filter: Omit<EmployeeFilter, "organizationId">,
): Prisma.EmployeeWhereInput[] => [
  ...(filter.employeeIds ? [{ id: { in: filter.employeeIds } }] : []),
  ...(filter.employeeId ? [{ id: filter.employeeId }] : []),
  ...(filter.divisionId ? [{ divisionId: filter.divisionId }] : []),
];

const recordWhere = (filter: RecordFilter, now: Date): Prisma.AttendanceWhereInput => ({
  organizationId: filter.organizationId,
  workDate: { gte: toDateColumn(filter.from), lte: toDateColumn(filter.to) },
  AND: [
    ...(filter.employeeIds ? [{ employeeId: { in: filter.employeeIds } }] : []),
    ...(filter.employeeId ? [{ employeeId: filter.employeeId }] : []),
    // The employee's current division (records don't keep a division snapshot)
    ...(filter.divisionId ? [{ employee: { divisionId: filter.divisionId } }] : []),
    ...(filter.status ? [{ status: filter.status }] : []),
    ...(filter.completion ? [completionWhere(filter.completion, now)] : []),
  ],
});

/** §4.3 — active and employed on `date`. */
const eligibleOn = (date: LocalDate): Prisma.EmployeeWhereInput => ({
  status: "active",
  employmentStartDate: { lte: toDateColumn(date) },
  OR: [{ employmentEndDate: null }, { employmentEndDate: { gte: toDateColumn(date) } }],
  ...notDeleted,
});

@Injectable()
export class ReportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Newest work date first, then employee number. */
  async listRecords(
    filter: RecordFilter,
    query: PaginationQuery,
    now: Date,
    tx: Tx = this.prisma,
  ): Promise<{ rows: ReportRow[]; total: number }> {
    const where = recordWhere(filter, now);
    const [rows, total] = await Promise.all([
      tx.attendance.findMany({
        where,
        select: reportRow,
        orderBy: [{ workDate: "desc" }, { employee: { employeeNumber: "asc" } }, { id: "asc" }],
        ...pageWindow(query),
      }),
      tx.attendance.count({ where }),
    ]);
    return { rows, total };
  }

  /** §13 — the counts behind a report, over exactly the rows listRecords pages through. */
  async summarize(filter: RecordFilter, now: Date, tx: Tx = this.prisma): Promise<SummaryCounts> {
    const where = recordWhere(filter, now);
    const [groups, incomplete, corrected] = await Promise.all([
      tx.attendance.groupBy({
        by: ["status", "completion"],
        where,
        _count: { _all: true },
        _sum: { workedMinutes: true, lateMinutes: true },
      }),
      tx.attendance.count({ where: { AND: [where, incompleteAt(now)] } }),
      tx.attendance.count({ where: { AND: [where, { correctedAt: { not: null } }] } }),
    ]);
    const counts: SummaryCounts = {
      records: 0,
      present: 0,
      late: 0,
      absent: 0,
      excused: 0,
      complete: 0,
      open: 0,
      incomplete,
      workedMinutes: 0,
      lateMinutes: 0,
      corrected,
    };
    for (const group of groups) {
      const n = group._count._all;
      counts.records += n;
      counts[group.status] += n;
      counts.lateMinutes += group._sum.lateMinutes ?? 0;
      if (group.completion === "complete") {
        counts.complete += n;
        counts.workedMinutes += group._sum.workedMinutes ?? 0;
      } else if (group.completion === "open") {
        counts.open += n;
      }
    }
    counts.open -= incomplete;
    return counts;
  }

  /** Counts per work date (dates without records are left out). */
  async dailyCounts(
    filter: RecordFilter,
    now: Date,
    tx: Tx = this.prisma,
  ): Promise<Map<string, DailyCounts>> {
    const where = recordWhere(filter, now);
    const [byStatus, incomplete] = await Promise.all([
      tx.attendance.groupBy({ by: ["workDate", "status"], where, _count: { _all: true } }),
      tx.attendance.groupBy({
        by: ["workDate"],
        where: { AND: [where, incompleteAt(now)] },
        _count: { _all: true },
      }),
    ]);
    const days = new Map<string, DailyCounts>();
    const day = (date: Date) => {
      const key = date.toISOString().slice(0, 10);
      let counts = days.get(key);
      if (!counts) days.set(key, (counts = { present: 0, late: 0, absent: 0, incomplete: 0 }));
      return counts;
    };
    for (const group of byStatus) {
      if (group.status !== "excused") day(group.workDate)[group.status] += group._count._all;
    }
    for (const group of incomplete) day(group.workDate).incomplete += group._count._all;
    return days;
  }

  /** Employees eligible on `date` in the filter, each with that day's record if any. */
  employeesOnDay(filter: EmployeeFilter, date: LocalDate, tx: Tx = this.prisma) {
    return tx.employee.findMany({
      where: {
        organizationId: filter.organizationId,
        ...eligibleOn(date),
        AND: employeeWhere(filter),
      },
      select: {
        ...employeeOfRow,
        attendances: { where: { workDate: toDateColumn(date) }, select: attendanceRow },
      },
      orderBy: [{ fullName: "asc" }, { id: "asc" }],
    });
  }

  /** How many employees are eligible on `date`, and how many of them have no record. */
  async eligibleCounts(
    filter: EmployeeFilter,
    date: LocalDate,
    tx: Tx = this.prisma,
  ): Promise<{ eligible: number; withoutRecord: number }> {
    const where: Prisma.EmployeeWhereInput = {
      organizationId: filter.organizationId,
      ...eligibleOn(date),
      AND: employeeWhere(filter),
    };
    const [eligible, withoutRecord] = await Promise.all([
      tx.employee.count({ where }),
      tx.employee.count({
        where: { ...where, attendances: { none: { workDate: toDateColumn(date) } } },
      }),
    ]);
    return { eligible, withoutRecord };
  }

  /** Open records of `date` whose scheduled end has passed ("Not checked out"). */
  countNotCheckedOut(filter: RecordFilter, now: Date, tx: Tx = this.prisma): Promise<number> {
    return tx.attendance.count({
      where: {
        AND: [recordWhere(filter, now), { completion: "open", scheduledEndAt: { lt: now } }],
      },
    });
  }

  countPendingCorrections(filter: EmployeeFilter, tx: Tx = this.prisma): Promise<number> {
    return tx.correctionRequest.count({
      where: {
        organizationId: filter.organizationId,
        status: "pending",
        ...(filter.employeeIds || filter.employeeId || filter.divisionId
          ? { employee: { AND: employeeWhere(filter) } }
          : {}),
      },
    });
  }
}
