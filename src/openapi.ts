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
  return cleanupOpenApiDoc(restoreNullableScalars(document));
}

type SchemaNode = Record<string, unknown>;
const isNode = (value: unknown): value is SchemaNode => typeof value === "object" && value !== null;

/**
 * nestjs-zod describes `z.string().nullable()` as `type: ["string", "null"]`, and
 * @nestjs/swagger reads any array `type` as "a list of the first type", so the field
 * became `string[]`. Swagger keeps nestjs-zod's empty-type marker, which real arrays
 * never carry: rewrite it as `anyOf: [T, null]`, the form cleanupOpenApiDoc turns into
 * `nullable: true` (as it already does for e.g. `z.email().nullable()`).
 */
export function restoreNullableScalars<T>(node: T): T {
  if (Array.isArray(node)) {
    for (const item of node) restoreNullableScalars(item);
  } else if (isNode(node)) {
    const { items } = node;
    if (node["x-nestjs_zod-empty-type"] === true && node.type === "array" && isNode(items)) {
      delete node.type;
      delete node.items;
      Object.assign(node, { anyOf: [items, { type: "null" }] });
    }
    for (const value of Object.values(node)) restoreNullableScalars(value);
  }
  return node;
}
