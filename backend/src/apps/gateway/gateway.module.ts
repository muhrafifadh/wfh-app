import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";

import { GatewayHealthController } from "@/apps/gateway/gateway.health.controller.js";
import { loggerModule } from "@/apps/logger.js";
import { ConfigModule } from "@/config/config.module.js";

/** Routing only: no database, no business rules and no authentication of its own. */
@Module({
  imports: [ConfigModule, loggerModule(), TerminusModule.forRoot({ logger: false })],
  controllers: [GatewayHealthController],
})
export class GatewayModule {}
