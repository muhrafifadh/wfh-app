import { Injectable } from "@nestjs/common";

import { AppConfig } from "@/config/config.module.js";
import { MailService } from "@/infra/mail/mail.service.js";
import { PrismaService } from "@/infra/prisma/prisma.service.js";
import { PASSWORD_RESET_TTL_MS } from "@/modules/auth/auth.constants.js";
import { InvalidResetTokenError } from "@/modules/auth/auth.errors.js";
import { generateToken, hashToken } from "@/modules/auth/auth.tokens.js";
import { PasswordResetRepository } from "@/modules/auth/password-reset.repository.js";
import { SessionsRepository } from "@/modules/auth/sessions.repository.js";
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
  ) {}

  /** Always succeeds from the caller's view, so it can't reveal which emails exist. */
  async request(email: string): Promise<void> {
    const user = await this.users.findLoginCandidate(email);
    if (!user || user.isDisabled) return;

    const token = generateToken();
    const now = new Date();
    await this.resets.replaceForUser(
      {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MS),
      },
      now,
    );

    const link = new URL("/reset-password", this.config.get("FRONTEND_URL"));
    link.searchParams.set("token", token);
    await this.mail.send({
      to: email,
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
    await this.prisma.$transaction(async (tx) => {
      const userId = await this.resets.claim(hashToken(token), now, tx);
      if (!userId) throw new InvalidResetTokenError();
      await this.users.setPassword(userId, password, tx);
      await this.sessions.revokeAllForUser(userId, now, tx);
    });
  }
}
