import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE, DiscoveryModule } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { ClsModule } from "nestjs-cls";
import { LoggerModule } from "nestjs-pino";
import { ZodSerializerInterceptor, ZodValidationPipe } from "nestjs-zod";

import { AllExceptionsFilter } from "@/common/filters/all-exceptions.filter.js";
import { RouteAuthAuditor } from "@/common/guards/route-auth.auditor.js";
import { AppThrottlerGuard } from "@/common/throttling/app-throttler.guard.js";
import { THROTTLE_KEY_FIELD, THROTTLERS } from "@/common/throttling/throttle-key.decorator.js";
import { REQUEST_ID_HEADER, resolveRequestId } from "@/common/http/request-id.js";
import { AppConfig, ConfigModule } from "@/config/config.module.js";
import { HealthModule } from "@/infra/health/health.module.js";
import { PrismaModule } from "@/infra/prisma/prisma.module.js";
import { AuthModule } from "@/modules/auth/auth.module.js";
import { JwtAuthGuard } from "@/modules/auth/guards/jwt-auth.guard.js";
import { PermissionsGuard } from "@/modules/auth/guards/permissions.guard.js";
import { UsersModule } from "@/modules/users/users.module.js";

@Module({
  imports: [
    ConfigModule,
    DiscoveryModule,
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        generateId: true,
        idGenerator: resolveRequestId,
      },
    }),
    LoggerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        pinoHttp: {
          level: config.get("LOG_LEVEL"),
          genReqId: (req, res) => {
            const id = resolveRequestId(req);
            res.setHeader(REQUEST_ID_HEADER, id);
            return id;
          },
          // docs/12-logging-and-observability.md — never log secrets
          redact: [
            "req.headers.authorization",
            "req.headers.cookie",
            "*.password",
            "*.passwordHash",
            "*.refreshToken",
            "*.accessToken",
            "*.token",
          ],
          autoLogging: {
            ignore: (req) => req.url?.startsWith("/health") ?? false,
          },
          transport: config.isProduction
            ? undefined
            : { target: "pino-pretty", options: { singleLine: true } },
        },
      }),
    }),
    // docs/13-security.md — global default; tighten per route with @Throttle()
    ThrottlerModule.forRoot([
      { name: THROTTLERS.default, ttl: 60_000, limit: 100 },
      {
        // Only on @ThrottleKey routes; see throttle-key.decorator.ts
        name: THROTTLERS.perIp,
        ttl: 60_000,
        limit: 100,
        skipIf: (context) => !Reflect.getMetadata(THROTTLE_KEY_FIELD, context.getHandler()),
      },
    ]),
    PrismaModule,
    HealthModule,
    UsersModule,
    AuthModule,
  ],
  providers: [
    // Global guards run in this order (docs/09-authorization.md)
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    RouteAuthAuditor,
  ],
})
export class AppModule {}
