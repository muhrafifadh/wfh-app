import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";

import { configureGateway } from "@/apps/gateway/configure-gateway.js";
import { GatewayModule } from "@/apps/gateway/gateway.module.js";
import { AppConfig } from "@/config/config.module.js";

const app = await NestFactory.create<NestExpressApplication>(GatewayModule, {
  bufferLogs: true,
  bodyParser: false, // Requests pass through untouched
});
configureGateway(app);
await app.listen(app.get(AppConfig).get("PORT"));
