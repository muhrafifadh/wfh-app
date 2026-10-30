import { Injectable } from "@nestjs/common";

import { pageWindow } from "@/common/dto/pagination.js";
import { toDateColumn, type LocalDate } from "@/common/time/zoned-time.js";
import type { Prisma } from "@/generated/prisma/client.js";
import { PrismaService } from "@/infra/prisma/prisma.service.js";
import type { Tx } from "@/infra/prisma/prisma.types.js";
import { notDeleted } from "@/infra/prisma/soft-delete.js";
import type { ListHolidaysQueryInput } from "@/modules/holidays/dto/list-holidays.query.js";

const holidayRow = {
  id: true,
  organizationId: true,
  date: true,
  name: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.HolidaySelect;

export type HolidayRow = Prisma.HolidayGetPayload<{ select: typeof holidayRow }>;

const dateRange = (from?: LocalDate, to?: LocalDate): Prisma.HolidayWhereInput =>
  from || to
    ? { date: { ...(from && { gte: toDateColumn(from) }), ...(to && { lte: toDateColumn(to) }) } }
    : {};

@Injectable()
export class HolidaysRepository {
  constructor(private readonly prisma: PrismaService) {}

  findInOrganization(organizationId: string, id: string, tx: Tx = this.prisma) {
    return tx.holiday.findFirst({
      where: { id, organizationId, ...notDeleted },
      select: holidayRow,
    });
  }

  /** The active holiday on a date, if any (other than `exceptId`). */
  findOnDate(organizationId: string, date: LocalDate, exceptId?: string, tx: Tx = this.prisma) {
    return tx.holiday.findFirst({
      where: {
        organizationId,
        date: toDateColumn(date),
        ...notDeleted,
        ...(exceptId && { id: { not: exceptId } }),
      },
      select: holidayRow,
    });
  }

  /** Active holidays from `from` to `to`, oldest first (for the work calendar). */
  findBetween(organizationId: string, from: LocalDate, to: LocalDate, tx: Tx = this.prisma) {
    return tx.holiday.findMany({
      where: { organizationId, ...notDeleted, ...dateRange(from, to) },
      select: holidayRow,
      orderBy: { date: "asc" },
    });
  }

  async list(
    organizationId: string,
    query: ListHolidaysQueryInput,
    tx: Tx = this.prisma,
  ): Promise<{ rows: HolidayRow[]; total: number }> {
    const where: Prisma.HolidayWhereInput = {
      organizationId,
      ...notDeleted,
      ...dateRange(query.from, query.to),
    };
    const [rows, total] = await Promise.all([
      tx.holiday.findMany({
        where,
        select: holidayRow,
        orderBy: [{ date: "asc" }, { id: "asc" }],
        ...pageWindow(query),
      }),
      tx.holiday.count({ where }),
    ]);
    return { rows, total };
  }

  insert(
    data: { organizationId: string; createdById: string; date: Date; name: string },
    tx: Tx = this.prisma,
  ): Promise<HolidayRow> {
    return tx.holiday.create({ data, select: holidayRow });
  }

  update(
    id: string,
    data: { date?: Date; name?: string },
    tx: Tx = this.prisma,
  ): Promise<HolidayRow> {
    return tx.holiday.update({ where: { id }, data, select: holidayRow });
  }

  async softDelete(id: string, now: Date, tx: Tx = this.prisma): Promise<void> {
    await tx.holiday.update({ where: { id }, data: { deletedAt: now } });
  }

  /**
   * Serializes holiday date changes in the organization until the transaction ends:
   * "one active holiday per date" is checked here, not by an index (it can't skip
   * deleted rows without a partial index Prisma can't describe).
   */
  async lockHolidays(organizationId: string, tx: Tx): Promise<void> {
    const key = `holiday:${organizationId}`;
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
  }
}
