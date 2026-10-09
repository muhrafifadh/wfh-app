import { Injectable } from "@nestjs/common";

import { PrismaService } from "@/infra/prisma/prisma.service.js";
import type { Tx } from "@/infra/prisma/prisma.types.js";

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string, tx: Tx = this.prisma) {
    return tx.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true, disabledAt: true },
    });
  }

  findActiveWithRole(id: string, tx: Tx = this.prisma) {
    return tx.user.findFirst({
      where: { id, disabledAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        organizationId: true,
        role: { select: { permissions: true } },
      },
    });
  }
}
