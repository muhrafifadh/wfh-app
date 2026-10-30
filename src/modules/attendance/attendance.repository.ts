import { Injectable } from "@nestjs/common";

import { pageWindow, type PaginationQuery } from "@/common/dto/pagination.js";
import { toDateColumn, type LocalDate } from "@/common/time/zoned-time.js";
import { Prisma, type AttendanceStatus } from "@/generated/prisma/client.js";
import { PrismaService } from "@/infra/prisma/prisma.service.js";
import type { Tx } from "@/infra/prisma/prisma.types.js";
import { attendanceRow, type AttendanceRow } from "@/modules/attendance/attendance.mapper.js";

export type { AttendanceRow };

export type CheckInInsert = Pick<
  AttendanceRow,
  | "organizationId"
  | "employeeId"
  | "workScheduleId"
  | "workDate"
  | "status"
  | "lateMinutes"
  | "checkInAt"
  | "scheduleTimezone"
  | "scheduledStartAt"
  | "scheduledEndAt"
  | "onTimeDeadlineAt"
  | "checkInOpensAt"
  | "checkInClosesAt"
  | "checkOutClosesAt"
>;

/** The employee already has a record for that work date (the unique constraint). */
export const DUPLICATE = Symbol("duplicate");

const rangeWhere = (from?: LocalDate, to?: LocalDate): Prisma.AttendanceWhereInput =>
  from || to
    ? {
        workDate: {
          ...(from && { gte: toDateColumn(from) }),
          ...(to && { lte: toDateColumn(to) }),
        },
      }
    : {};

@Injectable()
export class AttendanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  findForDate(
    organizationId: string,
    employeeId: string,
    workDate: LocalDate,
    tx: Tx = this.prisma,
  ): Promise<AttendanceRow | null> {
    return tx.attendance.findUnique({
      where: {
        organizationId_employeeId_workDate: {
          organizationId,
          employeeId,
          workDate: toDateColumn(workDate),
        },
      },
      select: attendanceRow,
    });
  }

  /** A record of this employee, or null if missing or someone else's. */
  findOwn(
    organizationId: string,
    employeeId: string,
    id: string,
    tx: Tx = this.prisma,
  ): Promise<AttendanceRow | null> {
    return tx.attendance.findFirst({
      where: { id, organizationId, employeeId },
      select: attendanceRow,
    });
  }

  /** Any record of the organization, or null if missing or elsewhere. */
  findInOrganization(
    organizationId: string,
    id: string,
    tx: Tx = this.prisma,
  ): Promise<AttendanceRow | null> {
    return tx.attendance.findFirst({ where: { id, organizationId }, select: attendanceRow });
  }

  async listOwn(
    organizationId: string,
    employeeId: string,
    query: PaginationQuery & { from?: LocalDate; to?: LocalDate; status?: AttendanceStatus },
    tx: Tx = this.prisma,
  ): Promise<{ rows: AttendanceRow[]; total: number }> {
    const where: Prisma.AttendanceWhereInput = {
      organizationId,
      employeeId,
      ...rangeWhere(query.from, query.to),
      ...(query.status && { status: query.status }),
    };
    const [rows, total] = await Promise.all([
      tx.attendance.findMany({
        where,
        select: attendanceRow,
        orderBy: [{ workDate: "desc" }, { id: "asc" }],
        ...pageWindow(query),
      }),
      tx.attendance.count({ where }),
    ]);
    return { rows, total };
  }

  /** Every record of the employee in a range (at most MAX_RANGE_DAYS rows). */
  findOwnBetween(
    organizationId: string,
    employeeId: string,
    from: LocalDate,
    to: LocalDate,
    tx: Tx = this.prisma,
  ): Promise<AttendanceRow[]> {
    return tx.attendance.findMany({
      where: { organizationId, employeeId, ...rangeWhere(from, to) },
      select: attendanceRow,
      orderBy: { workDate: "asc" },
    });
  }

  async insertCheckIn(
    data: CheckInInsert,
    tx: Tx = this.prisma,
  ): Promise<AttendanceRow | typeof DUPLICATE> {
    try {
      return await tx.attendance.create({
        data: { ...data, completion: "open", source: "self_service" },
        select: attendanceRow,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return DUPLICATE;
      }
      throw error;
    }
  }

  /**
   * §10 — inserts ABSENT rows for employees with no record yet; existing rows (with or
   * without check-out) are left exactly as they are. Returns how many were created.
   */
  async insertAbsences(
    rows: (Omit<CheckInInsert, "status" | "lateMinutes" | "checkInAt"> & {
      closeDayRunId: string;
    })[],
    tx: Tx = this.prisma,
  ): Promise<number> {
    const { count } = await tx.attendance.createMany({
      data: rows.map((row) => ({
        ...row,
        status: "absent" as const,
        completion: "not_applicable" as const,
        source: "close_day_job" as const,
        lateMinutes: 0,
      })),
      skipDuplicates: true,
    });
    return count;
  }

  /**
   * §8.3 compare-and-set: records the check-out only if there's none yet and the row
   * is still at `version`. Null when another request got there first.
   */
  async checkOut(
    id: string,
    version: number,
    data: { checkOutAt: Date; workedMinutes: number },
    tx: Tx = this.prisma,
  ): Promise<AttendanceRow | null> {
    const { count } = await tx.attendance.updateMany({
      where: { id, version, checkOutAt: null },
      data: { ...data, completion: "complete", version: { increment: 1 } },
    });
    return count === 1
      ? tx.attendance.findUniqueOrThrow({ where: { id }, select: attendanceRow })
      : null;
  }

  /**
   * §11.5 — applies approved timestamps and their recalculated values if the row is
   * still at `version`. Null when it changed since (version conflict).
   */
  async applyCorrection(
    id: string,
    version: number,
    data: Pick<
      AttendanceRow,
      "status" | "completion" | "checkInAt" | "checkOutAt" | "lateMinutes" | "workedMinutes"
    > & { correctedAt: Date },
    tx: Tx = this.prisma,
  ): Promise<AttendanceRow | null> {
    const { count } = await tx.attendance.updateMany({
      where: { id, version },
      data: { ...data, version: { increment: 1 } },
    });
    return count === 1
      ? tx.attendance.findUniqueOrThrow({ where: { id }, select: attendanceRow })
      : null;
  }
}
