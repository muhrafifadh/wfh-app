import { Global, Module } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";

import { AppConfig } from "@/config/config.module.js";
import { MailService } from "@/infra/mail/mail.service.js";
import { ConsoleMailer, DisabledMailer, MemoryMailer } from "@/infra/mail/mailers.js";
import { SmtpMailer } from "@/infra/mail/smtp-mailer.js";

@Global()
@Module({
  providers: [
    {
      provide: MailService,
      inject: [AppConfig, PinoLogger],
      useFactory: (config: AppConfig, logger: PinoLogger): MailService => {
        switch (config.get("MAIL_TRANSPORT")) {
          case "smtp": {
            const url = config.get("SMTP_URL");
            const from = config.get("MAIL_FROM");
            // env validation guarantees both; this keeps the types honest
            if (!url || !from) throw new Error("MAIL_TRANSPORT=smtp needs SMTP_URL and MAIL_FROM");
            return new SmtpMailer(url, from);
          }
          case "console":
            return new ConsoleMailer(logger);
          case "memory":
            return new MemoryMailer();
          case "disabled":
            return new DisabledMailer(logger);
        }
      },
    },
  ],
  exports: [MailService],
})
export class MailModule {}
