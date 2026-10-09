import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";

import { hash } from "@node-rs/argon2";
import type { Queue } from "bullmq";

import { generateToken, hashToken } from "@/common/crypto/tokens.js";
import type { Paginated } from "@/common/dto/pagination.js";
import { NotFoundError } from "@/common/errors/app-error.js";
import { isPermission, type AuthUser, type Permission } from "@/common/types/auth.js";
import { AppConfig } from "@/config/config.module.js";
import { MailService } from "@/infra/mail/mail.service.js";
import { PrismaService } from "@/infra/prisma/prisma.service.js";
import type { Tx } from "@/infra/prisma/prisma.types.js";
import type { InviteUserInput } from "@/modules/users/dto/invite-user.dto.js";
import type { ListUsersQueryInput } from "@/modules/users/dto/list-users.query.js";
import type { RoleResponseBody } from "@/modules/users/dto/role.response.js";
import type { UpdateUserInput } from "@/modules/users/dto/update-user.dto.js";
import type { UserResponseBody } from "@/modules/users/dto/user.response.js";
import {
  USER_EMAILS_QUEUE,
  userEmailJobId,
  type UserEmailJob,
  type UserEmailJobName,
} from "@/modules/users/jobs/user-emails.queue.js";
import {
  EMAIL_VERIFICATION_TTL_MS,
  INVITATION_TTL_MS,
  type UserStatus,
} from "@/modules/users/users.constants.js";
import {
  CannotChangeOwnAccountError,
  EmailTakenError,
  InvalidInvitationTokenError,
  InvalidVerificationTokenError,
  UserNotInvitedError,
} from "@/modules/users/users.errors.js";
import { USER_EVENTS, UserEvent } from "@/modules/users/users.events.js";
import { UsersRepository, type UserRow } from "@/modules/users/users.repository.js";

/** Null passwordHash: invited and not accepted yet, so there's nothing to check against. */
export type LoginCandidate = {
  id: string;
  organizationId: string;
  passwordHash: string | null;
  isDisabled: boolean;
};

export type ActiveUser = {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  emailVerified: boolean;
  permissions: Permission[];
};

const statusOf = (row: Pick<UserRow, "disabledAt" | "passwordHash">): UserStatus =>
  row.disabledAt ? "deactivated" : row.passwordHash === null ? "invited" : "active";

/** Prisma row → response body (docs/06-validation-and-dtos.md: dates become ISO strings here). */
const toUser = (row: UserRow): UserResponseBody => ({
  id: row.id,
  email: row.email,
  name: row.name,
  role: row.role,
  status: statusOf(row),
  emailVerified: row.emailVerifiedAt !== null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

@Injectable()
export class UsersService {
  constructor(
    private readonly repo: UsersRepository,
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: AppConfig,
    private readonly events: EventEmitter2,
    @InjectQueue(USER_EMAILS_QUEUE) private readonly emails: Queue<UserEmailJob>,
  ) {}

  // Used by auth

  async findLoginCandidate(email: string): Promise<LoginCandidate | null> {
    const user = await this.repo.findByEmail(email);
    if (!user) return null;
    return {
      id: user.id,
      organizationId: user.organizationId,
      passwordHash: user.passwordHash,
      isDisabled: user.disabledAt !== null,
    };
  }

  /** The user with their current permissions, or null if missing or disabled. */
  async findActive(id: string): Promise<ActiveUser | null> {
    const user = await this.repo.findActiveWithRole(id);
    if (!user) return null;
    const { role, emailVerifiedAt, ...rest } = user;
    // Unknown strings in the DB (e.g. a removed permission) are ignored, not trusted.
    return {
      ...rest,
      emailVerified: emailVerifiedAt !== null,
      permissions: role.permissions.filter(isPermission),
    };
  }

  /** Creates a new organization with this user as its owner, and asks them to verify their email. */
  async registerOwner(input: {
    email: string;
    name: string;
    password: string;
    organizationName: string;
  }): Promise<{ id: string; organizationId: string }> {
    const { password, ...rest } = input;
    const user = await this.repo.createOwner({ ...rest, passwordHash: await hash(password) });
    if (!user) throw new EmailTakenError();
    return user;
  }

  async setPassword(id: string, password: string, tx?: Tx): Promise<void> {
    await this.repo.updatePasswordHash(id, await hash(password), tx);
  }

  // Managing users (user:read / user:manage)

  async list(user: AuthUser, query: ListUsersQueryInput): Promise<Paginated<UserResponseBody>> {
    const { rows, total } = await this.repo.list(user.organizationId, query);
    return { items: rows.map(toUser), page: query.page, pageSize: query.pageSize, total };
  }

  async findOne(user: AuthUser, id: string): Promise<UserResponseBody> {
    return toUser(await this.load(user, id));
  }

  async listRoles(user: AuthUser): Promise<{ items: RoleResponseBody[] }> {
    const roles = await this.repo.findRolesInOrganization(user.organizationId);
    return {
      items: roles.map((role) => ({ ...role, permissions: role.permissions.filter(isPermission) })),
    };
  }

  /** Creates the account without a password and emails a link to set one. */
  async invite(user: AuthUser, input: InviteUserInput): Promise<UserResponseBody> {
    const role = await this.assertRole(user, input.roleId);
    const invited = await this.repo.insertInvited({
      ...input,
      organizationId: user.organizationId,
    });
    if (!invited) throw new EmailTakenError();

    // After the insert has committed (docs/15-background-jobs.md#consistency-enqueue-after-commit)
    await this.enqueueEmail("invitation", invited.id);
    await this.emit(USER_EVENTS.invited, user, invited.id, { role: role.name });
    return toUser(invited);
  }

  /** Sends a fresh invitation link (the old one stops working). */
  async resendInvitation(user: AuthUser, id: string): Promise<UserResponseBody> {
    const target = await this.load(user, id);
    if (statusOf(target) !== "invited") throw new UserNotInvitedError();
    await this.enqueueEmail("invitation", id);
    return toUser(target);
  }

  async update(user: AuthUser, id: string, input: UpdateUserInput): Promise<UserResponseBody> {
    const target = await this.load(user, id);
    const roleChanges = input.roleId !== undefined && input.roleId !== target.role.id;
    if (roleChanges && id === user.id) throw new CannotChangeOwnAccountError("change the role of");
    if (roleChanges && input.roleId) await this.assertRole(user, input.roleId);

    const updated = await this.repo.update(id, input);
    await this.emit(USER_EVENTS.updated, user, id, {
      fields: Object.keys(input),
      ...(roleChanges && { roleFrom: target.role.name, roleTo: updated.role.name }),
    });
    return toUser(updated);
  }

  /** Blocks sign-in. Safe to repeat: deactivating a deactivated user changes nothing. */
  async deactivate(user: AuthUser, id: string): Promise<UserResponseBody> {
    const target = await this.load(user, id);
    if (id === user.id) throw new CannotChangeOwnAccountError("deactivate");
    if (target.disabledAt) return toUser(target);

    const updated = await this.repo.update(id, { disabledAt: new Date() });
    // auth revokes their sessions on this event; the audit log records it
    await this.emit(USER_EVENTS.deactivated, user, id);
    return toUser(updated);
  }

  async reactivate(user: AuthUser, id: string): Promise<UserResponseBody> {
    const target = await this.load(user, id);
    if (!target.disabledAt) return toUser(target);

    const updated = await this.repo.update(id, { disabledAt: null });
    await this.emit(USER_EVENTS.reactivated, user, id);
    return toUser(updated);
  }

  // Email links (invitation, verification)

  /** Sets the password of an invited user. Returns the user, now able to sign in. */
  async acceptInvitation(
    token: string,
    password: string,
  ): Promise<{ id: string; organizationId: string }> {
    const passwordHash = await hash(password);
    const now = new Date();
    const user = await this.prisma.$transaction(async (tx) => {
      const userId = await this.repo.claimToken(hashToken(token), "invitation", now, tx);
      const invited = userId ? await this.repo.findForEmail(userId, tx) : null;
      // Already accepted or deactivated since the invitation was sent
      if (!invited || invited.passwordHash !== null || invited.disabledAt) {
        throw new InvalidInvitationTokenError();
      }
      await this.repo.acceptInvitation(invited.id, passwordHash, now, tx);
      return invited;
    });

    await this.events.emitAsync(
      USER_EVENTS.invitationAccepted,
      new UserEvent(USER_EVENTS.invitationAccepted, user.organizationId, user.id, user.id),
    );
    return { id: user.id, organizationId: user.organizationId };
  }

  async verifyEmail(token: string): Promise<void> {
    const now = new Date();
    const user = await this.prisma.$transaction(async (tx) => {
      const userId = await this.repo.claimToken(hashToken(token), "email_verification", now, tx);
      if (!userId) throw new InvalidVerificationTokenError();
      await this.repo.markEmailVerified(userId, now, tx);
      return this.repo.findForEmail(userId, tx);
    });
    if (!user) throw new InvalidVerificationTokenError();

    await this.events.emitAsync(
      USER_EVENTS.emailVerified,
      new UserEvent(USER_EVENTS.emailVerified, user.organizationId, user.id, user.id),
    );
  }

  /** Queues a verification email unless the address is already verified. */
  async requestEmailVerification(userId: string): Promise<void> {
    const user = await this.repo.findForEmail(userId);
    if (!user || user.emailVerifiedAt) return;
    await this.enqueueEmail("email-verification", userId);
  }

  // Called by the user-emails processor. Each one is safe to run again on retry:
  // it checks the user still needs the email, then issues a fresh link.

  async sendInvitation(userId: string): Promise<void> {
    const user = await this.repo.findForEmail(userId);
    if (!user || user.passwordHash !== null || user.disabledAt) return; // accepted or cancelled

    const link = await this.issueLink(userId, "invitation", INVITATION_TTL_MS, "/accept-invite");
    await this.mail.send({
      to: user.email,
      subject: `You're invited to ${user.organization.name}`,
      text: [
        `Hi ${user.name},`,
        `You've been invited to join ${user.organization.name}.`,
        `Set your password to get started (valid for 7 days): ${link}`,
        "If you weren't expecting this, you can ignore this email.",
      ].join("\n\n"),
    });
  }

  async sendEmailVerification(userId: string): Promise<void> {
    const user = await this.repo.findForEmail(userId);
    if (!user || user.emailVerifiedAt || user.disabledAt || user.passwordHash === null) return;

    const link = await this.issueLink(
      userId,
      "email_verification",
      EMAIL_VERIFICATION_TTL_MS,
      "/verify-email",
    );
    await this.mail.send({
      to: user.email,
      subject: "Verify your email",
      text: [
        `Hi ${user.name},`,
        `Confirm this is your email address (valid for 24 hours): ${link}`,
        "If you didn't create an account, you can ignore this email.",
      ].join("\n\n"),
    });
  }

  // Helpers

  /** The user if they're in the caller's organization; 404 otherwise (docs/09-authorization.md). */
  private async load(user: AuthUser, id: string): Promise<UserRow> {
    const target = await this.repo.findInOrganization(user.organizationId, id);
    if (!target) throw new NotFoundError("User");
    return target;
  }

  private async assertRole(user: AuthUser, roleId: string): Promise<{ id: string; name: string }> {
    const role = await this.repo.findRoleInOrganization(user.organizationId, roleId);
    if (!role) throw new NotFoundError("Role");
    return role;
  }

  private async issueLink(
    userId: string,
    purpose: "invitation" | "email_verification",
    ttlMs: number,
    path: string,
  ): Promise<string> {
    const token = generateToken();
    const now = new Date();
    await this.repo.replaceToken(
      { userId, purpose, tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + ttlMs) },
      now,
    );
    const link = new URL(path, this.config.get("FRONTEND_URL"));
    link.searchParams.set("token", token);
    return link.toString();
  }

  private async enqueueEmail(name: UserEmailJobName, userId: string): Promise<void> {
    await this.emails.add(name, { userId }, { jobId: userEmailJobId(name, userId) });
  }

  private async emit(
    name: (typeof USER_EVENTS)[keyof typeof USER_EVENTS],
    actor: AuthUser,
    targetId: string,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    await this.events.emitAsync(
      name,
      new UserEvent(name, actor.organizationId, actor.id, targetId, metadata),
    );
  }
}
