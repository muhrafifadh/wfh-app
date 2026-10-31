import { writeFileSync } from "node:fs";

import { NestFactory } from "@nestjs/core";

import { AppModule } from "@/app.module.js";
import { applyGlobalPrefix, buildOpenApiDocument } from "@/openapi.js";

/**
 * Writes openapi.json from the controllers and Zod DTOs. Preview mode builds
 * the module graph without instantiating providers, so no database is needed.
 * Run with `pnpm openapi`; CI fails if the committed file is out of date.
 */
const app = await NestFactory.create(AppModule, { preview: true, logger: false });
applyGlobalPrefix(app);
const document = buildOpenApiDocument(app);
writeFileSync("openapi.json", `${JSON.stringify(document, null, 2)}\n`);
await app.close();
