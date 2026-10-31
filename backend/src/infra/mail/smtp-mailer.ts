import type { OnModuleDestroy } from "@nestjs/common";

import { createTransport, type Transporter } from "nodemailer";

import { MailService, type MailMessage } from "@/infra/mail/mail.service.js";

/**
 * Real delivery over SMTP (any provider: SES, Postmark, Resend, Mailgun, …).
 * Throws on failure; callers decide whether that's fatal.
 */
export class SmtpMailer extends MailService implements OnModuleDestroy {
  private readonly transporter: Transporter;

  constructor(
    smtpUrl: string,
    private readonly from: string,
  ) {
    super();
    this.transporter = createTransport({
      url: smtpUrl,
      // Fail fast: a stuck SMTP server must not hold requests open
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({ from: this.from, ...message });
  }

  onModuleDestroy(): void {
    this.transporter.close();
  }
}
