import { Injectable } from "@nestjs/common";

import { pageWindow, parseSort } from "@/common/dto/pagination.js";
import { DEFAULT_ROLES } from "@/common/types/auth.js";
import { Prisma, type UserTokenPurpose } from "@/generated/prisma/client.js";
import { PrismaService } from "@/infra/prisma/prisma.service.js";
import type { Tx } from "@/infra/prisma/prisma.types.js";
import { notDeleted } from "@/infra/prisma/soft-delete.js";
import type { ListUsersQueryInput } from "@/modules/users/dto/list-users.query.js";
import type { UserStatus } from "@/modules/users/users.constants.js";

const userRow = {
  id: true,
  organizationId: true,
  email: true,
  name: true,
  passwordHash: true,
  emailVerifiedAt: true,
  disabledAt: true,
  createdAt: true,
  updatedAt: true,
  role: { select: { id: true, name: true } },
} satisfies Prisma.UserSelect;

export type UserRow = Prisma.UserGetPayload<{ select: typeof userRow }>;

const statusFilter: Record<UserStatus, Prisma.UserWhereInput> = {
  deactivated: { disabledAt: { not: null } },
  invited: { disabledAt: null, passwordHash: null },
  active: { disabledAt: null, passwordHash: { not: null } },
};

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string, tx: Tx = this.prisma) {
    return tx.user.findFirst({
      where: { email, ...notDeleted },
      select: { id: true, organizationId: true, passwordHash: true, disabledAt: true },
    });
  }

  findActiveWithRole(id: string, tx: Tx = this.prisma) {
    return tx.user.findFirst({
      where: { id, disabledAt: null, ...notDeleted },
      select: {
        id: true,
        email: true,
        name: true,
        organizationId: true,
        emailVerifiedAt: true,
        role: { select: { id: true, name: true, permissions: true } },
      },
    });
  }

  /** Any user of the organization, deactivated ones included. Null if missing or elsewhere. */
  findInOrganization(organizationId: string, id: string, tx: Tx = this.prisma) {
    return tx.user.findFirst({
      where: { id, organizationId, ...notDeleted },
      select: userRow,
    });
  }

  /** For email jobs: what the message needs, regardless of organization (the job only has an id). */
  findForEmail(id: string, tx: Tx = this.prisma) {
    return tx.user.findFirst({
      where: { id, ...notDeleted },
      select: {
        id: true,
        organizationId: true,
        email: true,
        name: true,
        passwordHash: true,
        emailVerifiedAt: true,
        disabledAt: true,
        organization: { select: { name: true } },
      },
    });
  }

  /**
   * Accounts that can receive email: accepted their invitation, not deactivated or
   * deleted. Narrowed to some ids, or to a role permission (notifications).
   */
  findContacts(
    organizationId: string,
    filter: { ids: string[] } | { permission: string },
    tx: Tx = this.prisma,
  ) {
    return tx.user.findMany({
      where: {
        organizationId,
        ...statusFilter.active,
        ...notDeleted,
        ...("ids" in filter
          ? { id: { in: filter.ids } }
          : { role: { permissions: { has: filter.permission } } }),
      },
      select: { id: true, email: true, name: true, role: { select: { permissions: true } } },
      orderBy: { id: "asc" },
    });
  }

  /** Names for display, deactivated and deleted users included. */
  findNames(organizationId: string, ids: string[], tx: Tx = this.prisma) {
    return tx.user.findMany({
      where: { organizationId, id: { in: ids } },
      select: { id: true, name: true },
    });
  }

  async list(
    organizationId: string,
    query: ListUsersQueryInput,
    tx: Tx = this.prisma,
  ): Promise<{ rows: UserRow[]; total: number }> {
    const where: Prisma.UserWhereInput = {
      organizationId,
      ...notDeleted,
      ...(query.status && statusFilter[query.status]),
      ...(query.roleId && { roleId: query.roleId }),
      ...(query.q && {
        OR: [
          { name: { contains: query.q, mode: "insensitive" } },
          { email: { contains: query.q, mode: "insensitive" } },
        ],
      }),
    };
    const { field, direction } = parseSort(query.sort);
    const [rows, total] = await Promise.all([
      tx.user.findMany({
        where,
        select: userRow,
        // Ends with id so pages are stable (docs/07-database-and-prisma.md)
        orderBy: [{ [field]: direction }, { id: "asc" }],
        ...pageWindow(query),
      }),
      tx.user.count({ where }),
    ]);
    return { rows, total };
  }

  /** An invited user: no password until they accept. Null if the email is taken. */
  async insertInvited(
    data: { organizationId: string; roleId: string; email: string; name: string },
    tx: Tx = this.prisma,
  ): Promise<UserRow | null> {
    try {
      return await tx.user.create({ data, select: userRow });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        return null;
      throw error;
    }
  }

  update(
    id: string,
    data: { name?: string; roleId?: string; disabledAt?: Date | null },
    tx: Tx = this.prisma,
  ): Promise<UserRow> {
    return tx.user.update({ where: { id }, data, select: userRow });
  }

  /**
   * Self-signup: a new organization with the default roles (DEFAULT_ROLES),
   * and the user as owner. Returns null if the email is taken.
   */
  async createOwner(data: {
    email: string;
    name: string;
    passwordHash: string;
    organizationName: string;
  }): Promise<{ id: string; organizationId: string } | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const organization = await tx.organization.create({
          data: { name: data.organizationName },
          select: { id: true },
        });
        await tx.role.createMany({
          data: Object.entries(DEFAULT_ROLES).map(([name, permissions]) => ({
            organizationId: organization.id,
            name,
            permissions: [...permissions],
          })),
        });
        const owner = await tx.role.findUniqueOrThrow({
          where: { organizationId_name: { organizationId: organization.id, name: "owner" } },
          select: { id: true },
        });
        return tx.user.create({
          data: {
            email: data.email,
            name: data.name,
            passwordHash: data.passwordHash,
            organizationId: organization.id,
            roleId: owner.id,
          },
          select: { id: true, organizationId: true },
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

  /** Accepting an invitation proves the email works, so it's verified too. */
  async acceptInvitation(
    id: string,
    passwordHash: string,
    now: Date,
    tx: Tx = this.prisma,
  ): Promise<void> {
    await tx.user.update({ where: { id }, data: { passwordHash, emailVerifiedAt: now } });
  }

  async markEmailVerified(id: string, now: Date, tx: Tx = this.prisma): Promise<void> {
    await tx.user.updateMany({
      where: { id, emailVerifiedAt: null },
      data: { emailVerifiedAt: now },
    });
  }

  // Roles

  findRolesInOrganization(organizationId: string, tx: Tx = this.prisma) {
    return tx.role.findMany({
      where: { organizationId, ...notDeleted },
      select: { id: true, name: true, permissions: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: 100,
    });
  }

  findRoleInOrganization(organizationId: string, id: string, tx: Tx = this.prisma) {
    return tx.role.findFirst({
      where: { id, organizationId, ...notDeleted },
      select: { id: true, name: true },
    });
  }

  // Single-use email links (invitations, email verification)

  /** Only the newest link of a kind works: older unused ones are retired. */
  async replaceToken(
    data: { userId: string; purpose: UserTokenPurpose; tokenHash: string; expiresAt: Date },
    now: Date,
    tx: Tx = this.prisma,
  ): Promise<void> {
    await tx.userToken.updateMany({
      where: { userId: data.userId, purpose: data.purpose, usedAt: null },
      data: { usedAt: now },
    });
    await tx.userToken.create({ data });
  }

  /** Atomically uses a valid token. Returns its user, or null if invalid, used or expired. */
  async claimToken(
    tokenHash: string,
    purpose: UserTokenPurpose,
    now: Date,
    tx: Tx = this.prisma,
  ): Promise<string | null> {
    const token = await tx.userToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, purpose: true },
    });
    if (!token || token.purpose !== purpose) return null;
    const { count } = await tx.userToken.updateMany({
      where: { id: token.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    return count === 1 ? token.userId : null;
  }
}
