import { BullModule } from "@nestjs/bullmq";
import { Global, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { Authenticator } from "@/common/contracts/directory.js";
import { AppConfig } from "@/config/config.module.js";
import { ACCESS_TOKEN_TTL_SECONDS } from "@/modules/auth/auth.constants.js";
import { AuthController } from "@/modules/auth/auth.controller.js";
import { AuthService } from "@/modules/auth/auth.service.js";
import { PasswordResetProcessor } from "@/modules/auth/jobs/password-reset.processor.js";
import { PASSWORD_RESET_QUEUE } from "@/modules/auth/jobs/password-reset.queue.js";
import { SessionsListener } from "@/modules/auth/listeners/sessions.listener.js";
import { PasswordResetRepository } from "@/modules/auth/password-reset.repository.js";
import { PasswordResetService } from "@/modules/auth/password-reset.service.js";
import { SessionsRepository } from "@/modules/auth/sessions.repository.js";
import { UsersModule } from "@/modules/users/users.module.js";

@Global()
@Module({
  imports: [
    UsersModule,
    BullModule.registerQueue({ name: PASSWORD_RESET_QUEUE }),
    JwtModule.registerAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => {
        const claims = { issuer: config.get("JWT_ISSUER"), audience: config.get("JWT_AUDIENCE") };
        return {
          secret: config.get("JWT_ACCESS_SECRET"),
          signOptions: { algorithm: "HS256", expiresIn: ACCESS_TOKEN_TTL_SECONDS, ...claims },
          verifyOptions: { algorithms: ["HS256"], ...claims },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: Authenticator, useExisting: AuthService },
    SessionsRepository,
    SessionsListener,
    PasswordResetService,
    PasswordResetRepository,
    PasswordResetProcessor,
  ],
  // The global guards (registered in FoundationModule) need the Authenticator.
  exports: [AuthService, Authenticator],
})
export class AuthModule {}
