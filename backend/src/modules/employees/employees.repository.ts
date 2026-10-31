import { Injectable } from "@nestjs/common";

import { pageWindow, parseSort } from "@/common/dto/pagination.js";
import { Prisma } from "@/generated/prisma/client.js";
import { PrismaService } from "@/infra/prisma/prisma.service.js";
import type { Tx } from "@/infra/prisma/prisma.types.js";
import { notDeleted } from "@/infra/prisma/soft-delete.js";
import type { ListEmployeesQueryInput } from "@/modules/employees/dto/list-employees.query.js";
import {
  MAX_REPORTING_DEPTH,
  type EmployeeStatus,
} from "@/modules/employees/employees.constants.js";

const employeeRow = {
  id: true,
  organizationId: true,
  userId: true,
  divisionId: true,
  managerId: true,
  employeeNumber: true,
  fullName: true,
  workEmail: true,
  jobTitle: true,
  status: true,
  employmentStartDate: true,
  employmentEndDate: true,
  createdAt: true,
  updatedAt: true,
  division: { select: { id: true, code: true, name: true } },
  manager: { select: { id: true, employeeNumber: true, fullName: true } },
  user: {
    select: {
      id: true,
      email: true,
      passwordHash: true,
      disabledAt: true,
      role: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.EmployeeSelect;

export type EmployeeRow = Prisma.EmployeeGetPayload<{ select: typeof employeeRow }>;

export type EmployeeWrite = {
  fullName?: string;
  workEmail?: string | null;
  jobTitle?: string | null;
  divisionId?: string;
  managerId?: string | null;
  employmentStartDate?: Date;
  employmentEndDate?: Date | null;
};

/** The employee number is already used in the organization. */
export const DUPLICATE = Symbol("duplicate");

const isDuplicate = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

@Injectable()
export class EmployeesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findInOrganization(
    organizationId: string,
    id: string,
    tx: Tx = this.prisma,
  ): Promise<EmployeeRow | null> {
    return tx.employee.findFirst({
      where: { id, organizationId, ...notDeleted },
      select: employeeRow,
    });
  }

  findByUser(
    organizationId: string,
    userId: string,
    tx: Tx = this.prisma,
  ): Promise<EmployeeRow | null> {
    return tx.employee.findFirst({
      where: { userId, organizationId, ...notDeleted },
      select: employeeRow,
    });
  }

  async list(
    organizationId: string,
    query: ListEmployeesQueryInput,
    tx: Tx = this.prisma,
  ): Promise<{ rows: EmployeeRow[]; total: number }> {
    const where: Prisma.EmployeeWhereInput = {
      organizationId,
      ...notDeleted,
      ...(query.status && { status: query.status }),
      ...(query.divisionId && { divisionId: query.divisionId }),
      ...(query.managerId && { managerId: query.managerId }),
      ...(query.q && {
        OR: [
          { fullName: { contains: query.q, mode: "insensitive" } },
          { employeeNumber: { contains: query.q, mode: "insensitive" } },
          { workEmail: { contains: query.q, mode: "insensitive" } },
        ],
      }),
    };
    const { field, direction } = parseSort(query.sort);
    const [rows, total] = await Promise.all([
      tx.employee.findMany({
        where,
        select: employeeRow,
        orderBy: [{ [field]: direction }, { id: "asc" }],
        ...pageWindow(query),
      }),
      tx.employee.count({ where }),
    ]);
    return { rows, total };
  }

  async insert(
    data: EmployeeWrite & {
      organizationId: string;
      employeeNumber: string;
      fullName: string;
      divisionId: string;
      employmentStartDate: Date;
    },
    tx: Tx = this.prisma,
  ): Promise<EmployeeRow | typeof DUPLICATE> {
    try {
      return await tx.employee.create({ data, select: employeeRow });
    } catch (error) {
      if (isDuplicate(error)) return DUPLICATE;
      throw error;
    }
  }

  update(id: string, data: EmployeeWrite, tx: Tx = this.prisma): Promise<EmployeeRow> {
    return tx.employee.update({ where: { id }, data, select: employeeRow });
  }

  setStatus(id: string, status: EmployeeStatus, tx: Tx = this.prisma): Promise<EmployeeRow> {
    return tx.employee.update({ where: { id }, data: { status }, select: employeeRow });
  }

  /**
   * Links the user if the employee has none yet. Null when the employee got an
   * account in the meantime, DUPLICATE when the user belongs to another employee.
   */
  async linkUser(
    id: string,
    userId: string,
    tx: Tx = this.prisma,
  ): Promise<EmployeeRow | null | typeof DUPLICATE> {
    try {
      const { count } = await tx.employee.updateMany({
        where: { id, userId: null },
        data: { userId },
      });
      return count === 1
        ? tx.employee.findUniqueOrThrow({ where: { id }, select: employeeRow })
        : null;
    } catch (error) {
      if (isDuplicate(error)) return DUPLICATE;
      throw error;
    }
  }

  /**
   * Active employees employed on `date`, by id after `afterId` (keyset batches for
   * close-day). Deactivated ones are left out, so deactivation stops future absences.
   */
  async eligibleIdsOn(
    organizationId: string,
    date: Date,
    afterId: string | null,
    take: number,
    tx: Tx = this.prisma,
  ): Promise<string[]> {
    const rows = await tx.employee.findMany({
      where: {
        organizationId,
        ...notDeleted,
        status: "active",
        employmentStartDate: { lte: date },
        OR: [{ employmentEndDate: null }, { employmentEndDate: { gte: date } }],
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

  /** Names for display, deleted employees included (history outlives them). */
  findSummaries(organizationId: string, ids: string[], tx: Tx = this.prisma) {
    return tx.employee.findMany({
      where: { organizationId, id: { in: ids } },
      select: { id: true, employeeNumber: true, fullName: true, status: true, managerId: true },
    });
  }

  // Reporting lines

  /**
   * Serializes manager changes in the organization until the transaction ends, so
   * two concurrent changes (A → B, B → A) can't build a cycle between them.
   */
  async lockReportingLines(organizationId: string, tx: Tx): Promise<void> {
    const key = `reporting-line:${organizationId}`;
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
  }

  /** True if `employeeId` is `managerId` or anywhere above it in the reporting line. */
  async isInReportingLine(
    organizationId: string,
    managerId: string,
    employeeId: string,
    tx: Tx = this.prisma,
  ): Promise<boolean> {
    const [row] = await tx.$queryRaw<{ found: boolean }[]>`
      WITH RECURSIVE chain AS (
        SELECT id, manager_id, 1 AS depth
        FROM employees
        WHERE id = ${managerId}::uuid AND organization_id = ${organizationId}::uuid
        UNION ALL
        SELECT e.id, e.manager_id, chain.depth + 1
        FROM employees e
        JOIN chain ON e.id = chain.manager_id
        WHERE chain.depth < ${MAX_REPORTING_DEPTH}
      )
      SELECT EXISTS (SELECT 1 FROM chain WHERE id = ${employeeId}::uuid) AS found`;
    return row?.found ?? false;
  }
}
