import { Injectable } from "@nestjs/common";

import { PinoLogger } from "nestjs-pino";

import { MailService, type MailMessage } from "@/infra/mail/mail.service.js";

/**
 * Development only: prints the whole email, links and tokens included, so you
 * can follow reset links locally. Refused in production by env validation.
 */
@Injectable()
export class ConsoleMailer extends MailService {
  constructor(private readonly logger: PinoLogger) {
    super();
    this.logger.setContext(ConsoleMailer.name);
  }

  async send(message: MailMessage): Promise<void> {
    this.logger.info(`\n--- email to ${message.to}: ${message.subject}\n${message.text}\n---`);
  }
}

/** Tests: keeps sent messages so they can be read back. */
@Injectable()
export class MemoryMailer extends MailService {
  readonly sent: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    this.sent.push(message);
  }
}

/** Drops messages. Production default until a real transport exists. */
@Injectable()
export class DisabledMailer extends MailService {
  constructor(private readonly logger: PinoLogger) {
    super();
    this.logger.setContext(DisabledMailer.name);
  }

  async send(message: MailMessage): Promise<void> {
    this.logger.warn({ subject: message.subject }, "Email not sent: MAIL_TRANSPORT=disabled");
  }
}
