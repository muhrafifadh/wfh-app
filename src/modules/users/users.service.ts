import { Injectable } from "@nestjs/common";

import { isPermission, type Permission } from "@/common/types/auth.js";
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
}
