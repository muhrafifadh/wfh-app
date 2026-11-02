import { Injectable } from "@nestjs/common";

import { Prisma, type IdempotencyAction } from "@/generated/attendance-db/client.js";
import { PrismaService } from "@/infra/attendance-db/prisma.service.js";
import type { Tx } from "@/infra/attendance-db/prisma.types.js";

export type IdempotencyClaim = {
  organizationId: string;
  userId: string;
  /** SHA-256 of the header value. */
  key: string;
  action: IdempotencyAction;
  requestHash: string;
  lockedAt: Date;
  expiresAt: Date;
};

const recordRow = {
  id: true,
  requestHash: true,
  responseStatus: true,
  responseBody: true,
  completedAt: true,
  expiresAt: true,
} satisfies Prisma.IdempotencyRecordSelect;

export type IdempotencyRow = Prisma.IdempotencyRecordGetPayload<{ select: typeof recordRow }>;

@Injectable()
export class IdempotencyRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Takes the key for this transaction. Returns null when taken, or the existing
   * record when another request already completed with it. A concurrent request with
   * the same key waits here until the first one commits (or rolls back and frees it).
   * An expired record is taken over.
   */
  async claim(data: IdempotencyClaim, tx: Tx): Promise<IdempotencyRow | null> {
    const { count } = await tx.idempotencyRecord.createMany({ data: [data], skipDuplicates: true });
    if (count === 1) return null;

    const where = {
      organizationId_userId_key: {
        organizationId: data.organizationId,
        userId: data.userId,
        key: data.key,
      },
    };
    const existing = await tx.idempotencyRecord.findUniqueOrThrow({ where, select: recordRow });
    if (existing.expiresAt > data.lockedAt) return existing;

    await tx.idempotencyRecord.update({
      where,
      data: {
        action: data.action,
        requestHash: data.requestHash,
        lockedAt: data.lockedAt,
        expiresAt: data.expiresAt,
        attendanceId: null,
        responseStatus: null,
        responseBody: Prisma.DbNull,
        completedAt: null,
      },
    });
    return null;
  }

  /** Deletes expired records (never attendance). Returns how many. */
  async purgeExpired(now: Date, tx: Tx = this.prisma): Promise<number> {
    const { count } = await tx.idempotencyRecord.deleteMany({ where: { expiresAt: { lte: now } } });
    return count;
  }

  async complete(
    claim: Pick<IdempotencyClaim, "organizationId" | "userId" | "key">,
    result: { attendanceId: string; responseStatus: number; responseBody: Prisma.InputJsonValue },
    completedAt: Date,
    tx: Tx,
  ): Promise<void> {
    await tx.idempotencyRecord.update({
      where: { organizationId_userId_key: claim },
      data: { ...result, completedAt },
    });
  }
}
