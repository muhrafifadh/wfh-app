import { Injectable } from "@nestjs/common";

import { pageWindow, type PaginationQuery } from "@/common/dto/pagination.js";
import { toDateColumn, type LocalDate } from "@/common/time/zoned-time.js";
import { Prisma } from "@/generated/prisma/client.js";
import { PrismaService } from "@/infra/prisma/prisma.service.js";
import type { Tx } from "@/infra/prisma/prisma.types.js";

const scheduleRow = {
  id: true,
  organizationId: true,
  name: true,
  scope: true,
  timezone: true,
  workingDays: true,
  startTime: true,
  endTime: true,
  toleranceMinutes: true,
  checkInOpensAt: true,
  checkInClosesAt: true,
  checkOutDeadline: true,
  effectiveFrom: true,
  effectiveTo: true,
  createdAt: true,
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.WorkScheduleSelect;

export type ScheduleRow = Prisma.WorkScheduleGetPayload<{ select: typeof scheduleRow }>;

export type ScheduleInsert = {
  organizationId: string;
  createdById: string;
  name: string;
  timezone: string;
  workingDays: number[];
  startTime: Date;
  endTime: Date;
  toleranceMinutes: number;
  checkInOpensAt: Date;
  checkInClosesAt: Date;
  checkOutDeadline: Date;
  effectiveFrom: Date;
};

/** Another version already starts on that date (the unique backstop). */
export const DUPLICATE = Symbol("duplicate");

/** Versions in force on some day of [from, to], newest first. */
const overlapping = (from: LocalDate, to: LocalDate | null): Prisma.WorkScheduleWhereInput => ({
  ...(to !== null && { effectiveFrom: { lte: toDateColumn(to) } }),
  OR: [{ effectiveTo: null }, { effectiveTo: { gte: toDateColumn(from) } }],
});

@Injectable()
export class WorkSettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Organization settings

  findSettings(organizationId: string, tx: Tx = this.prisma) {
    return tx.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: {
        name: true,
        timezone: true,
        supportContact: true,
        retentionYears: true,
        checkInReminderEnabled: true,
        checkInReminderAt: true,
        checkOutReminderEnabled: true,
        checkOutReminderAt: true,
      },
    });
  }

  updateSettings(
    organizationId: string,
    data: {
      supportContact?: string | null;
      retentionYears?: number;
      checkInReminderEnabled?: boolean;
      checkInReminderAt?: Date;
      checkOutReminderEnabled?: boolean;
      checkOutReminderAt?: Date;
    },
    tx: Tx = this.prisma,
  ) {
    return tx.organization.update({
      where: { id: organizationId },
      data,
      select: { id: true },
    });
  }

  /** Every organization, for jobs that run per organization (close-day). */
  async organizationIds(tx: Tx = this.prisma): Promise<string[]> {
    const rows = await tx.organization.findMany({
      where: { deletedAt: null },
      select: { id: true },
      orderBy: { id: "asc" },
    });
    return rows.map((row) => row.id);
  }

  // Schedule versions (organization scope only, for now)

  findSchedule(organizationId: string, id: string, tx: Tx = this.prisma) {
    return tx.workSchedule.findFirst({ where: { id, organizationId }, select: scheduleRow });
  }

  async listSchedules(
    organizationId: string,
    query: PaginationQuery,
    tx: Tx = this.prisma,
  ): Promise<{ rows: ScheduleRow[]; total: number }> {
    const where = { organizationId, scope: "organization" } as const;
    const [rows, total] = await Promise.all([
      tx.workSchedule.findMany({
        where,
        select: scheduleRow,
        orderBy: [{ effectiveFrom: "desc" }, { id: "asc" }],
        ...pageWindow(query),
      }),
      tx.workSchedule.count({ where }),
    ]);
    return { rows, total };
  }

  /** Versions in force on any day from `from` to `to` (or onwards when `to` is null), newest first. */
  findInForce(
    organizationId: string,
    from: LocalDate,
    to: LocalDate | null,
    tx: Tx = this.prisma,
  ): Promise<ScheduleRow[]> {
    return tx.workSchedule.findMany({
      where: { organizationId, scope: "organization", ...overlapping(from, to) },
      select: scheduleRow,
      orderBy: { effectiveFrom: "desc" },
      take: 100,
    });
  }

  async insertSchedule(
    data: ScheduleInsert,
    tx: Tx = this.prisma,
  ): Promise<ScheduleRow | typeof DUPLICATE> {
    try {
      return await tx.workSchedule.create({
        data: { ...data, scope: "organization" },
        select: scheduleRow,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return DUPLICATE;
      }
      throw error;
    }
  }

  /** Ends a version's period. Only effectiveTo changes: the policy fields are history. */
  async closeSchedule(id: string, effectiveTo: LocalDate, tx: Tx = this.prisma): Promise<void> {
    await tx.workSchedule.update({
      where: { id },
      data: { effectiveTo: toDateColumn(effectiveTo) },
    });
  }

  /** Serializes schedule changes in the organization until the transaction ends. */
  async lockSchedules(organizationId: string, tx: Tx): Promise<void> {
    const key = `work-schedule:${organizationId}`;
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
  }
}
