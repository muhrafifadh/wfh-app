import { RequestMethod, type INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from "@nestjs/swagger";

import { cleanupOpenApiDoc } from "nestjs-zod";

import { ErrorResponse } from "@/common/dto/error.response.js";

/** Same prefix everywhere: the running app, the e2e tests and the exported spec. */
export function applyGlobalPrefix(app: INestApplication): void {
  app.setGlobalPrefix("v1", {
    exclude: [
      { path: "health/live", method: RequestMethod.GET },
      { path: "health/ready", method: RequestMethod.GET },
    ],
  });
}

/**
 * The API contract (docs/05-api-design.md). Served at /docs outside production
 * and exported to openapi.json, which the frontend generates its types from.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle("backend-boilerplate API")
    .setVersion("1")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config, { extraModels: [ErrorResponse] });
  return cleanupOpenApiDoc(document);
}
