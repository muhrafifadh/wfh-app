import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { ClsModule } from "nestjs-cls";
import { LoggerModule } from "nestjs-pino";
import { ZodSerializerInterceptor, ZodValidationPipe } from "nestjs-zod";

import { AllExceptionsFilter } from "@/common/filters/all-exceptions.filter.js";
import { REQUEST_ID_HEADER, resolveRequestId } from "@/common/http/request-id.js";
import { AppConfig, ConfigModule } from "@/config/config.module.js";
import { HealthModule } from "@/infra/health/health.module.js";
import { PrismaModule } from "@/infra/prisma/prisma.module.js";

@Module({
  imports: [
    ConfigModule,
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
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
