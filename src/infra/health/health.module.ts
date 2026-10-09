import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";

import { HealthController } from "@/infra/health/health.controller.js";
import { RedisHealth } from "@/infra/redis/redis-health.js";

@Module({
  imports: [TerminusModule.forRoot({ logger: false })],
  controllers: [HealthController],
  providers: [RedisHealth],
})
export class HealthModule {}
