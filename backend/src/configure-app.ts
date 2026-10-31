import type { NestExpressApplication } from "@nestjs/platform-express";
import { SwaggerModule } from "@nestjs/swagger";

import helmet from "helmet";
import { Logger } from "nestjs-pino";

import { AppConfig } from "@/config/config.module.js";
import { applyGlobalPrefix, buildOpenApiDocument } from "@/openapi.js";

/**
 * Everything that makes the HTTP app behave like production.
 * Shared by main.ts and the e2e tests so tests exercise the real setup.
 */
export function configureApp(app: NestExpressApplication): NestExpressApplication {
  const config = app.get(AppConfig);

  app.useLogger(app.get(Logger));
  applyGlobalPrefix(app);

  // docs/13-security.md
  app.use(helmet());
  app.enableCors({ origin: config.get("CORS_ORIGINS"), credentials: true });
  app.useBodyParser("json", { limit: "1mb" });
  app.set("trust proxy", config.get("TRUST_PROXY"));

  app.enableShutdownHooks();

  if (!config.isProduction) {
    SwaggerModule.setup("docs", app, buildOpenApiDocument(app));
  }

  return app;
}
