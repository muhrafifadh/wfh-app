import { Injectable } from "@nestjs/common";

import { PrismaService } from "@/infra/prisma/prisma.service.js";
import type { Tx } from "@/infra/prisma/prisma.types.js";

@Injectable()
export class PasswordResetRepository {
  constructor(private readonly prisma: PrismaService) {}

  async replaceForUser(
    data: { userId: string; tokenHash: string; expiresAt: Date },
    now: Date,
    tx: Tx = this.prisma,
  ): Promise<void> {
    // Only the newest link works: older unused ones are retired.
    await tx.passwordResetToken.updateMany({
      where: { userId: data.userId, usedAt: null },
      data: { usedAt: now },
    });
    await tx.passwordResetToken.create({ data });
  }

  /** Atomically uses a valid token. Returns its user, or null if invalid, used or expired. */
  async claim(tokenHash: string, now: Date, tx: Tx = this.prisma): Promise<string | null> {
    const token = await tx.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true },
    });
    if (!token) return null;
    const { count } = await tx.passwordResetToken.updateMany({
      where: { id: token.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    return count === 1 ? token.userId : null;
  }
}
