import { Injectable } from "@nestjs/common";

import { PERMISSIONS } from "@/common/types/auth.js";
import { Prisma } from "@/generated/prisma/client.js";
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

  /**
   * Self-signup: a new organization with "owner" (all permissions) and
   * "member" roles, and the user as owner. Returns null if the email is taken.
   */
  async createOwner(data: {
    email: string;
    name: string;
    passwordHash: string;
    organizationName: string;
  }): Promise<{ id: string } | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const organization = await tx.organization.create({
          data: { name: data.organizationName },
          select: { id: true },
        });
        const owner = await tx.role.create({
          data: { organizationId: organization.id, name: "owner", permissions: [...PERMISSIONS] },
          select: { id: true },
        });
        await tx.role.create({
          data: { organizationId: organization.id, name: "member", permissions: ["user:read"] },
        });
        return tx.user.create({
          data: {
            email: data.email,
            name: data.name,
            passwordHash: data.passwordHash,
            organizationId: organization.id,
            roleId: owner.id,
          },
          select: { id: true },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        return null;
      throw error;
    }
  }

  async updatePasswordHash(id: string, passwordHash: string, tx: Tx = this.prisma): Promise<void> {
    await tx.user.update({ where: { id }, data: { passwordHash } });
  }
}
