import { Injectable } from "@nestjs/common";

import { PrismaService } from "@/infra/prisma/prisma.service.js";
import type { Tx } from "@/infra/prisma/prisma.types.js";

export type ClientInfo = { ip: string | null; userAgent: string | null };

@Injectable()
export class SessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  createSession(data: { userId: string; expiresAt: Date } & ClientInfo, tx: Tx = this.prisma) {
    return tx.session.create({ data, select: { id: true } });
  }

  findActiveSession(id: string, userId: string, now: Date, tx: Tx = this.prisma) {
    return tx.session.findFirst({
      where: { id, userId, revokedAt: null, expiresAt: { gt: now } },
      select: { id: true },
    });
  }

  touchSession(
    id: string,
    data: { lastUsedAt: Date; expiresAt: Date } & ClientInfo,
    tx: Tx = this.prisma,
  ) {
    return tx.session.update({ where: { id }, data, select: { id: true } });
  }

  async revokeSession(id: string, now: Date, tx: Tx = this.prisma): Promise<void> {
    await tx.session.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: now } });
  }

  async revokeAllForUser(userId: string, now: Date, tx: Tx = this.prisma): Promise<void> {
    await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
  }

  insertRefreshToken(
    data: { sessionId: string; tokenHash: string; expiresAt: Date },
    tx: Tx = this.prisma,
  ) {
    return tx.refreshToken.create({ data, select: { id: true } });
  }

  findRefreshTokenByHash(tokenHash: string, tx: Tx = this.prisma) {
    return tx.refreshToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        expiresAt: true,
        session: { select: { id: true, userId: true, revokedAt: true, expiresAt: true } },
      },
    });
  }

  /**
   * Atomically marks the token as used. Returns false if someone else already
   * used it — the row lock makes concurrent callers wait, then see usedAt set.
   */
  async claimRefreshToken(id: string, now: Date, tx: Tx = this.prisma): Promise<boolean> {
    const { count } = await tx.refreshToken.updateMany({
      where: { id, usedAt: null },
      data: { usedAt: now },
    });
    return count === 1;
  }

  async findRefreshTokenUsedAt(id: string, tx: Tx = this.prisma): Promise<Date | null> {
    const token = await tx.refreshToken.findUnique({ where: { id }, select: { usedAt: true } });
    return token?.usedAt ?? null;
  }
}
