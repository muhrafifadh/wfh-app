import { Injectable } from "@nestjs/common";

import { pageWindow } from "@/common/dto/pagination.js";
import type { Prisma } from "@/generated/employee-db/client.js";
import { PrismaService } from "@/infra/employee-db/prisma.service.js";
import type { Tx } from "@/infra/employee-db/prisma.types.js";
import { notDeleted } from "@/infra/prisma/soft-delete.js";

const uploadRow = {
  id: true,
  organizationId: true,
  uploadedById: true,
  key: true,
  filename: true,
  contentType: true,
  size: true,
  status: true,
  createdAt: true,
  uploadedBy: { select: { id: true, name: true } },
} satisfies Prisma.UploadSelect;

export type UploadRow = Prisma.UploadGetPayload<{ select: typeof uploadRow }>;

@Injectable()
export class UploadsRepository {
  constructor(private readonly prisma: PrismaService) {}

  insert(data: Prisma.UploadUncheckedCreateInput, tx: Tx = this.prisma): Promise<UploadRow> {
    return tx.upload.create({ data, select: uploadRow });
  }

  findInOrganization(organizationId: string, id: string, tx: Tx = this.prisma) {
    return tx.upload.findFirst({ where: { id, organizationId, ...notDeleted }, select: uploadRow });
  }

  /** Completed uploads of the organization, newest first. Pending ones are still in flight. */
  async listReady(
    organizationId: string,
    query: { page: number; pageSize: number; q?: string },
    tx: Tx = this.prisma,
  ): Promise<{ rows: UploadRow[]; total: number }> {
    const where: Prisma.UploadWhereInput = {
      organizationId,
      status: "ready",
      ...notDeleted,
      ...(query.q && { filename: { contains: query.q, mode: "insensitive" } }),
    };
    const [rows, total] = await Promise.all([
      tx.upload.findMany({
        where,
        select: uploadRow,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        ...pageWindow(query),
      }),
      tx.upload.count({ where }),
    ]);
    return { rows, total };
  }

  markReady(id: string, tx: Tx = this.prisma): Promise<UploadRow> {
    return tx.upload.update({ where: { id }, data: { status: "ready" }, select: uploadRow });
  }

  async softDelete(id: string, now: Date, tx: Tx = this.prisma): Promise<void> {
    await tx.upload.updateMany({ where: { id, ...notDeleted }, data: { deletedAt: now } });
  }

  /** Abandoned (pending too long) or deleted past retention: their files can go. */
  findExpired(pendingBefore: Date, deletedBefore: Date, take: number, tx: Tx = this.prisma) {
    return tx.upload.findMany({
      where: {
        OR: [
          { status: "pending", createdAt: { lt: pendingBefore } },
          { deletedAt: { lt: deletedBefore } },
        ],
      },
      select: { id: true, key: true },
      orderBy: { id: "asc" },
      take,
    });
  }

  /** Hard delete, for the cleanup job only (after the file is gone from storage). */
  async purge(ids: string[], tx: Tx = this.prisma): Promise<void> {
    await tx.upload.deleteMany({ where: { id: { in: ids } } });
  }
}
