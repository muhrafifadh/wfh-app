import { Controller, Get } from "@nestjs/common";
import { HealthCheck, HealthCheckService, HealthIndicatorService } from "@nestjs/terminus";

import { AppConfig } from "@/config/config.module.js";

const assertReady = async (url: string): Promise<void> => {
  const response = await fetch(`${url}/health/ready`);
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
};

@Controller("health")
export class GatewayHealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly indicator: HealthIndicatorService,
    private readonly config: AppConfig,
  ) {}

  @Get("live")
  @HealthCheck()
  live() {
    return this.health.check([]);
  }

  /** Ready when both services are: each checks its own database and Redis. */
  @Get("ready")
  @HealthCheck()
  ready() {
    return this.health.check([
      () =>
        this.indicator
          .check("employee-service")
          .attempt(() => assertReady(this.config.get("EMPLOYEE_SERVICE_URL")))
          .withTimeout(3000),
      () =>
        this.indicator
          .check("attendance-service")
          .attempt(() => assertReady(this.config.get("ATTENDANCE_SERVICE_URL")))
          .withTimeout(3000),
    ]);
  }
}
