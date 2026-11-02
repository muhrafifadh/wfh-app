import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { HealthCheck, HealthCheckService, HealthIndicatorService } from "@nestjs/terminus";
import { SkipThrottle } from "@nestjs/throttler";

import { Public } from "@/common/decorators/public.decorator.js";
import { DatabaseHealth } from "@/infra/health/database-health.js";
import { RedisHealth } from "@/infra/redis/redis-health.js";

// docs/12-logging-and-observability.md — served outside /v1.
@ApiTags("health")
@Public()
@SkipThrottle()
@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly indicator: HealthIndicatorService,
    private readonly database: DatabaseHealth,
    private readonly redis: RedisHealth,
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
          .attempt(() => this.database.ping())
          .withTimeout(3000),
      // Background jobs (and so emails) stop without Redis
      () =>
        this.indicator
          .check("redis")
          .attempt(() => this.redis.ping())
          .withTimeout(3000),
    ]);
  }
}
