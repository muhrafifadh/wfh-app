import { Global, Module } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";

import { AppConfig } from "@/config/config.module.js";
import { MailService } from "@/infra/mail/mail.service.js";
import { ConsoleMailer, DisabledMailer, MemoryMailer } from "@/infra/mail/mailers.js";

@Global()
@Module({
  providers: [
    {
      provide: MailService,
      inject: [AppConfig, PinoLogger],
      useFactory: (config: AppConfig, logger: PinoLogger): MailService => {
        switch (config.get("MAIL_TRANSPORT")) {
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
