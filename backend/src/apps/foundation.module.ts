import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE, DiscoveryModule } from "@nestjs/core";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ThrottlerModule } from "@nestjs/throttler";

import { ClsModule } from "nestjs-cls";
import { ZodSerializerInterceptor, ZodValidationPipe } from "nestjs-zod";

import { loggerModule } from "@/apps/logger.js";
import { AllExceptionsFilter } from "@/common/filters/all-exceptions.filter.js";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard.js";
import { PermissionsGuard } from "@/common/guards/permissions.guard.js";
import { RouteAuthAuditor } from "@/common/guards/route-auth.auditor.js";
import { resolveRequestId } from "@/common/http/request-id.js";
import { AppThrottlerGuard } from "@/common/throttling/app-throttler.guard.js";
import { THROTTLE_KEY_FIELD, THROTTLERS } from "@/common/throttling/throttle-key.decorator.js";
import { ConfigModule } from "@/config/config.module.js";
import { ClockModule } from "@/infra/clock/clock.module.js";
import { HealthModule } from "@/infra/health/health.module.js";
import { MailModule } from "@/infra/mail/mail.module.js";
import { QueueModule } from "@/infra/queue/queue.module.js";
import { StorageModule } from "@/infra/storage/storage.module.js";

/** What both services share: config, logging, guards, errors, queues, mail and storage. */
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
    loggerModule(),
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
    // docs/15-background-jobs.md — in-process events; listeners must not throw.
    // Wildcards let the audit log subscribe to "user.*" instead of listing each event.
    EventEmitterModule.forRoot({ wildcard: true, delimiter: "." }),
    ClockModule,
    MailModule,
    QueueModule,
    StorageModule,
    HealthModule,
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
export class FoundationModule {}
