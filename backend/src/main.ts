import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";

import { AppModule } from "@/app.module.js";
import { AppConfig } from "@/config/config.module.js";
import { configureApp } from "@/configure-app.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    bodyParser: false, // configureApp registers it with a size limit
  });
  configureApp(app);
  await app.listen(app.get(AppConfig).get("PORT"));
}

await bootstrap();
