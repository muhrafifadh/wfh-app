import { RequestMethod } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import helmet from "helmet";
import { Logger } from "nestjs-pino";
import { cleanupOpenApiDoc } from "nestjs-zod";

import { AppConfig } from "@/config/config.module.js";

/**
 * Everything that makes the HTTP app behave like production.
 * Shared by main.ts and the e2e tests so tests exercise the real setup.
 */
export function configureApp(app: NestExpressApplication): NestExpressApplication {
  const config = app.get(AppConfig);

  app.useLogger(app.get(Logger));
  app.setGlobalPrefix("v1", {
    exclude: [
      { path: "health/live", method: RequestMethod.GET },
      { path: "health/ready", method: RequestMethod.GET },
    ],
  });

  // docs/13-security.md
  app.use(helmet());
  app.enableCors({ origin: config.get("CORS_ORIGINS"), credentials: true });
  app.useBodyParser("json", { limit: "1mb" });
  app.set("trust proxy", config.get("TRUST_PROXY"));

  app.enableShutdownHooks();

  if (!config.isProduction) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle("API").setVersion("1").addBearerAuth().build(),
    );
    SwaggerModule.setup("docs", app, cleanupOpenApiDoc(document));
  }

  return app;
}
