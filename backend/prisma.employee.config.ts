// Runs outside Nest, so it loads env itself (NODE_ENV=test → .env.test).
import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

config({
  path: process.env.NODE_ENV === "test" ? ".env.test" : ".env",
  quiet: true,
});

export default defineConfig({
  schema: "prisma/employee/schema.prisma",
  migrations: { path: "prisma/employee/migrations" },
  datasource: { url: env("EMPLOYEE_DATABASE_URL") },
});
