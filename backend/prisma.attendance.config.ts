// Runs outside Nest, so it loads env itself (NODE_ENV=test → .env.test).
import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

config({
  path: process.env.NODE_ENV === "test" ? ".env.test" : ".env",
  quiet: true,
});

export default defineConfig({
  schema: "prisma/attendance/schema.prisma",
  migrations: { path: "prisma/attendance/migrations" },
  datasource: { url: env("ATTENDANCE_DATABASE_URL") },
});
