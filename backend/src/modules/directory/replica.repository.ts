import { Injectable } from "@nestjs/common";

import type {
  DivisionSnapshot,
  EmployeeSnapshot,
  OrganizationSnapshot,
} from "@/common/contracts/service-events.js";
import { PrismaService } from "@/infra/attendance-db/prisma.service.js";
import type { Tx } from "@/infra/attendance-db/prisma.types.js";
import { notDeleted } from "@/infra/prisma/soft-delete.js";

const date = (value: string) => new Date(value);
const optionalDate = (value: string | null) => (value === null ? null : new Date(value));

/** This service's copy of organizations, divisions and employees. */
@Injectable()
export class ReplicaRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Applying changes from the employee service

  /** Only the name is theirs: everything else on this row is this service's settings. */
  async applyOrganization(row: OrganizationSnapshot, tx: Tx = this.prisma): Promise<void> {
    await tx.organization.upsert({
      where: { id: row.id },
      update: { name: row.name },
      create: { id: row.id, name: row.name },
      select: { id: true },
    });
  }

  /** @returns false if a newer version of the row is already here (the message is stale). */
  async applyDivision(row: DivisionSnapshot, tx: Tx = this.prisma): Promise<boolean> {
    const data = {
      organizationId: row.organizationId,
      code: row.code,
      name: row.name,
      status: row.status,
      createdAt: date(row.createdAt),
      updatedAt: date(row.updatedAt),
      deletedAt: optionalDate(row.deletedAt),
    };
    const { count } = await tx.division.updateMany({
      where: { id: row.id, updatedAt: { lte: data.updatedAt } },
      data,
    });
    if (count > 0) return true;
    if (await tx.division.findUnique({ where: { id: row.id }, select: { id: true } })) return false;
    await tx.division.create({ data: { id: row.id, ...data }, select: { id: true } });
    return true;
  }

  /** @returns false if a newer version of the row is already here (the message is stale). */
  async applyEmployee(row: EmployeeSnapshot, tx: Tx = this.prisma): Promise<boolean> {
    const data = {
      organizationId: row.organizationId,
      userId: row.userId,
      divisionId: row.divisionId,
      managerId: row.managerId,
      employeeNumber: row.employeeNumber,
      fullName: row.fullName,
      status: row.status,
      employmentStartDate: date(row.employmentStartDate),
      employmentEndDate: optionalDate(row.employmentEndDate),
      createdAt: date(row.createdAt),
      updatedAt: date(row.updatedAt),
      deletedAt: optionalDate(row.deletedAt),
    };
    const { count } = await tx.employee.updateMany({
      where: { id: row.id, updatedAt: { lte: data.updatedAt } },
      data,
    });
    if (count > 0) return true;
    if (await tx.employee.findUnique({ where: { id: row.id }, select: { id: true } })) return false;
    await tx.employee.create({ data: { id: row.id, ...data }, select: { id: true } });
    return true;
  }

  // Reads behind EmployeeDirectory

  findByUser(organizationId: string, userId: string, tx: Tx = this.prisma) {
    return tx.employee.findFirst({
      where: { userId, organizationId, ...notDeleted },
      select: {
        id: true,
        employeeNumber: true,
        fullName: true,
        status: true,
        employmentStartDate: true,
        employmentEndDate: true,
      },
    });
  }

  /**
   * Who close-day must account for on `date`: active, not deleted, employed that day.
   * One batch at a time, in id order.
   */
  async eligibleIdsOn(
    organizationId: string,
    day: Date,
    afterId: string | null,
    take: number,
    tx: Tx = this.prisma,
  ): Promise<string[]> {
    const rows = await tx.employee.findMany({
      where: {
        organizationId,
        ...notDeleted,
        status: "active",
        employmentStartDate: { lte: day },
        OR: [{ employmentEndDate: null }, { employmentEndDate: { gte: day } }],
        ...(afterId && { id: { gt: afterId } }),
      },
      select: { id: true },
      orderBy: { id: "asc" },
      take,
    });
    return rows.map((row) => row.id);
  }

  /** Active, non-deleted direct reports of `managerId` (a manager's team, §12). */
  async activeReportIds(
    organizationId: string,
    managerId: string,
    tx: Tx = this.prisma,
  ): Promise<string[]> {
    const rows = await tx.employee.findMany({
      where: { organizationId, managerId, status: "active", ...notDeleted },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  /** Accounts linked to these employees (notifications). */
  findAccounts(organizationId: string, ids: string[], tx: Tx = this.prisma) {
    return tx.employee.findMany({
      where: { organizationId, id: { in: ids }, userId: { not: null }, ...notDeleted },
      select: { id: true, userId: true },
    });
  }

  findNameAndManager(organizationId: string, id: string, tx: Tx = this.prisma) {
    return tx.employee.findFirst({
      where: { id, organizationId, ...notDeleted },
      select: { fullName: true, managerId: true },
    });
  }

  findManagerAccount(organizationId: string, managerId: string, tx: Tx = this.prisma) {
    return tx.employee.findFirst({
      where: { id: managerId, organizationId },
      select: { userId: true, status: true, deletedAt: true },
    });
  }

  /** Names for display, deleted employees included (history outlives them). */
  findSummaries(organizationId: string, ids: string[], tx: Tx = this.prisma) {
    return tx.employee.findMany({
      where: { organizationId, id: { in: ids } },
      select: { id: true, employeeNumber: true, fullName: true, status: true, managerId: true },
    });
  }
}
