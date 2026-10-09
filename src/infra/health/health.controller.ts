import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { HealthCheck, HealthCheckService, HealthIndicatorService } from "@nestjs/terminus";
import { SkipThrottle } from "@nestjs/throttler";

import { Public } from "@/common/decorators/public.decorator.js";
import { PrismaService } from "@/infra/prisma/prisma.service.js";

// docs/12-logging-and-observability.md — served outside /v1.
@ApiTags("health")
@Public()
@SkipThrottle()
@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly indicator: HealthIndicatorService,
    private readonly prisma: PrismaService,
  ) {}

  /** Liveness: the process responds. Never touches dependencies. */
  @Get("live")
  @HealthCheck()
  live() {
    return this.health.check([]);
  }

  /** Readiness: dependencies needed to serve traffic are reachable. */
  @Get("ready")
  @HealthCheck()
  ready() {
    return this.health.check([
      () =>
        this.indicator
          .check("database")
          .attempt(async () => {
            await this.prisma.$queryRaw`SELECT 1`;
          })
          .withTimeout(3000),
    ]);
  }
}
