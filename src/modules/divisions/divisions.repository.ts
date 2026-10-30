import { Injectable } from "@nestjs/common";

import { pageWindow, parseSort } from "@/common/dto/pagination.js";
import { Prisma } from "@/generated/prisma/client.js";
import { PrismaService } from "@/infra/prisma/prisma.service.js";
import type { Tx } from "@/infra/prisma/prisma.types.js";
import { notDeleted } from "@/infra/prisma/soft-delete.js";
import type { DivisionStatus } from "@/modules/divisions/divisions.constants.js";
import type { ListDivisionsQueryInput } from "@/modules/divisions/dto/list-divisions.query.js";

const divisionRow = {
  id: true,
  organizationId: true,
  code: true,
  name: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DivisionSelect;

export type DivisionRow = Prisma.DivisionGetPayload<{ select: typeof divisionRow }>;

/** A unique constraint (code or name) was violated; the service works out which. */
export const DUPLICATE = Symbol("duplicate");

const isDuplicate = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

@Injectable()
export class DivisionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findInOrganization(organizationId: string, id: string, tx: Tx = this.prisma) {
    return tx.division.findFirst({
      where: { id, organizationId, ...notDeleted },
      select: divisionRow,
    });
  }

  /** Another division with this code (exact) or name (ignoring case), if any. */
  findClash(
    organizationId: string,
    values: { code?: string; name?: string },
    exceptId?: string,
    tx: Tx = this.prisma,
  ) {
    const OR: Prisma.DivisionWhereInput[] = [
      ...(values.code ? [{ code: values.code }] : []),
      ...(values.name ? [{ name: { equals: values.name, mode: "insensitive" as const } }] : []),
    ];
    if (OR.length === 0) return Promise.resolve(null);
    return tx.division.findFirst({
      where: { organizationId, OR, ...(exceptId && { id: { not: exceptId } }) },
      select: { code: true, name: true },
    });
  }

  async list(
    organizationId: string,
    query: ListDivisionsQueryInput,
    tx: Tx = this.prisma,
  ): Promise<{ rows: DivisionRow[]; total: number }> {
    const where: Prisma.DivisionWhereInput = {
      organizationId,
      ...notDeleted,
      ...(query.status && { status: query.status }),
      ...(query.q && {
        OR: [
          { code: { contains: query.q, mode: "insensitive" } },
          { name: { contains: query.q, mode: "insensitive" } },
        ],
      }),
    };
    const { field, direction } = parseSort(query.sort);
    const [rows, total] = await Promise.all([
      tx.division.findMany({
        where,
        select: divisionRow,
        orderBy: [{ [field]: direction }, { id: "asc" }],
        ...pageWindow(query),
      }),
      tx.division.count({ where }),
    ]);
    return { rows, total };
  }

  async insert(
    data: { organizationId: string; code: string; name: string },
    tx: Tx = this.prisma,
  ): Promise<DivisionRow | typeof DUPLICATE> {
    try {
      return await tx.division.create({ data, select: divisionRow });
    } catch (error) {
      if (isDuplicate(error)) return DUPLICATE;
      throw error;
    }
  }

  async update(
    id: string,
    data: { code?: string; name?: string },
    tx: Tx = this.prisma,
  ): Promise<DivisionRow | typeof DUPLICATE> {
    try {
      return await tx.division.update({ where: { id }, data, select: divisionRow });
    } catch (error) {
      if (isDuplicate(error)) return DUPLICATE;
      throw error;
    }
  }

  setStatus(id: string, status: DivisionStatus, tx: Tx = this.prisma): Promise<DivisionRow> {
    return tx.division.update({ where: { id }, data: { status }, select: divisionRow });
  }
}
