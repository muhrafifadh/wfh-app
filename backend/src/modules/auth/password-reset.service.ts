import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";

import type { Queue } from "bullmq";
import { PinoLogger } from "nestjs-pino";

import { generateToken, hashToken } from "@/common/crypto/tokens.js";
import { AppConfig } from "@/config/config.module.js";
import { PrismaService } from "@/infra/employee-db/prisma.service.js";
import { MailService } from "@/infra/mail/mail.service.js";
import { PASSWORD_RESET_TTL_MS } from "@/modules/auth/auth.constants.js";
import { InvalidResetTokenError } from "@/modules/auth/auth.errors.js";
import {
  PASSWORD_RESET_QUEUE,
  passwordResetJobId,
  type PasswordResetJob,
} from "@/modules/auth/jobs/password-reset.queue.js";
import { PasswordResetRepository } from "@/modules/auth/password-reset.repository.js";
import { SessionsRepository } from "@/modules/auth/sessions.repository.js";
import { USER_EVENTS, UserEvent } from "@/modules/users/users.events.js";
import { UsersService } from "@/modules/users/users.service.js";

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly users: UsersService,
    private readonly resets: PasswordResetRepository,
    private readonly sessions: SessionsRepository,
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: AppConfig,
    private readonly events: EventEmitter2,
    private readonly logger: PinoLogger,
    @InjectQueue(PASSWORD_RESET_QUEUE) private readonly queue: Queue<PasswordResetJob>,
  ) {
    this.logger.setContext(PasswordResetService.name);
  }

  /**
   * Queues the email and returns. Always succeeds from the caller's view, so it
   * can't reveal which emails exist, not even through a slow or failing queue.
   */
  async request(email: string): Promise<void> {
    const user = await this.users.findLoginCandidate(email);
    if (!user || user.isDisabled) return;

    try {
      await this.queue.add("send", { userId: user.id }, { jobId: passwordResetJobId(user.id) });
    } catch (error) {
      // An error only for existing accounts would reveal which emails exist
      this.logger.error({ err: error, userId: user.id }, "Queueing password reset email failed");
    }
  }

  /**
   * Run by PasswordResetProcessor. Issues a fresh link (older ones stop working)
   * and emails it. Throws on mail failure so the job is retried.
   */
  async send(userId: string): Promise<void> {
    const user = await this.users.findActive(userId);
    if (!user) return; // deactivated or deleted since the request

    const token = generateToken();
    const now = new Date();
    await this.resets.replaceForUser(
      {
        userId,
        tokenHash: hashToken(token),
        expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MS),
      },
      now,
    );

    const link = new URL("/reset-password", this.config.get("FRONTEND_URL"));
    link.searchParams.set("token", token);
    await this.mail.send({
      to: user.email,
      subject: "Reset your password",
      text: [
        "Someone asked to reset the password for this account.",
        `Reset it here (valid for 30 minutes): ${link.toString()}`,
        "If it wasn't you, ignore this email: your password stays the same.",
      ].join("\n\n"),
    });
  }

  /** Sets the new password and signs the user out everywhere. */
  async confirm(token: string, password: string): Promise<void> {
    const now = new Date();
    const userId = await this.prisma.$transaction(async (tx) => {
      const claimed = await this.resets.claim(hashToken(token), now, tx);
      if (!claimed) throw new InvalidResetTokenError();
      await this.users.setPassword(claimed, password, tx);
      await this.sessions.revokeAllForUser(claimed, now, tx);
      return claimed;
    });

    const user = await this.users.findActive(userId);
    if (user) {
      // No actor: whoever had the emailed link did it
      await this.events.emitAsync(
        USER_EVENTS.passwordReset,
        new UserEvent(USER_EVENTS.passwordReset, user.organizationId, null, userId),
      );
    }
  }
}
