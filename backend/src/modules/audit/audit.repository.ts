import { Injectable } from "@nestjs/common";

import { pageWindow } from "@/common/dto/pagination.js";
import type { Prisma } from "@/generated/prisma/client.js";
import { PrismaService } from "@/infra/prisma/prisma.service.js";
import type { Tx } from "@/infra/prisma/prisma.types.js";
import type { ListAuditLogsQueryInput } from "@/modules/audit/dto/list-audit-logs.query.js";

const auditRow = {
  id: true,
  action: true,
  targetType: true,
  targetId: true,
  metadata: true,
  requestId: true,
  createdAt: true,
  actor: { select: { id: true, name: true, email: true } },
} satisfies Prisma.AuditLogSelect;

export type AuditRow = Prisma.AuditLogGetPayload<{ select: typeof auditRow }>;

/** Append-only: there are no update or delete methods on purpose. */
@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  async insert(data: Prisma.AuditLogUncheckedCreateInput, tx: Tx = this.prisma): Promise<void> {
    await tx.auditLog.create({ data, select: { id: true } });
  }

  async list(
    organizationId: string,
    query: ListAuditLogsQueryInput,
    tx: Tx = this.prisma,
  ): Promise<{ rows: AuditRow[]; total: number }> {
    const where: Prisma.AuditLogWhereInput = {
      organizationId,
      ...(query.action && { action: query.action }),
      ...(query.actorId && { actorId: query.actorId }),
      ...(query.targetId && { targetId: query.targetId }),
    };
    const [rows, total] = await Promise.all([
      tx.auditLog.findMany({
        where,
        select: auditRow,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        ...pageWindow(query),
      }),
      tx.auditLog.count({ where }),
    ]);
    return { rows, total };
  }
}
