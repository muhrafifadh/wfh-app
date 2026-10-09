import { Injectable } from "@nestjs/common";

import { hash } from "@node-rs/argon2";

import { isPermission, type Permission } from "@/common/types/auth.js";
import type { Tx } from "@/infra/prisma/prisma.types.js";
import { EmailTakenError } from "@/modules/users/users.errors.js";
import { UsersRepository } from "@/modules/users/users.repository.js";

export type LoginCandidate = { id: string; passwordHash: string; isDisabled: boolean };

export type ActiveUser = {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  permissions: Permission[];
};

@Injectable()
export class UsersService {
  constructor(private readonly repo: UsersRepository) {}

  async findLoginCandidate(email: string): Promise<LoginCandidate | null> {
    const user = await this.repo.findByEmail(email);
    if (!user) return null;
    return { id: user.id, passwordHash: user.passwordHash, isDisabled: user.disabledAt !== null };
  }

  /** The user with their current permissions, or null if missing or disabled. */
  async findActive(id: string): Promise<ActiveUser | null> {
    const user = await this.repo.findActiveWithRole(id);
    if (!user) return null;
    const { role, ...rest } = user;
    // Unknown strings in the DB (e.g. a removed permission) are ignored, not trusted.
    return { ...rest, permissions: role.permissions.filter(isPermission) };
  }

  /** Creates a new organization with this user as its owner. */
  async registerOwner(input: {
    email: string;
    name: string;
    password: string;
    organizationName: string;
  }): Promise<{ id: string }> {
    const { password, ...rest } = input;
    const user = await this.repo.createOwner({ ...rest, passwordHash: await hash(password) });
    if (!user) throw new EmailTakenError();
    return user;
  }

  async setPassword(id: string, password: string, tx?: Tx): Promise<void> {
    await this.repo.updatePasswordHash(id, await hash(password), tx);
  }
}
