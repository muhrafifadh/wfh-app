import { writeFileSync } from "node:fs";

import type { Type } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { OpenAPIObject } from "@nestjs/swagger";

import { AttendanceServiceModule } from "@/apps/attendance/attendance.module.js";
import { EmployeeServiceModule } from "@/apps/employee/employee.module.js";
import { applyGlobalPrefix, buildOpenApiDocument } from "@/openapi.js";

/**
 * Writes openapi.json from the controllers and Zod DTOs of both services, because clients
 * see one API behind the gateway. Preview mode builds the module graph without
 * instantiating providers, so no database is needed. Run with `pnpm openapi`; CI fails if
 * the committed file is out of date.
 */
const documentOf = async (module: Type): Promise<OpenAPIObject> => {
  const app = await NestFactory.create(module, { preview: true, logger: false });
  applyGlobalPrefix(app);
  const document = buildOpenApiDocument(app);
  await app.close();
  return document;
};

const sortedKeys = <T>(record: Record<string, T> = {}): Record<string, T> =>
  Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));

const employee = await documentOf(EmployeeServiceModule);
const attendance = await documentOf(AttendanceServiceModule);
const tags = [...(employee.tags ?? []), ...(attendance.tags ?? [])];
const merged: OpenAPIObject = {
  ...employee,
  tags: [...new Map(tags.map((tag) => [tag.name, tag])).values()],
  paths: sortedKeys({ ...employee.paths, ...attendance.paths }),
  components: {
    ...employee.components,
    schemas: sortedKeys({ ...employee.components?.schemas, ...attendance.components?.schemas }),
  },
};
writeFileSync("openapi.json", `${JSON.stringify(merged, null, 2)}\n`);
