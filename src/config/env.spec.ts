import { envSchema } from "@/config/env.js";

const base = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  REDIS_URL: "redis://localhost:6379",
  JWT_ACCESS_SECRET: "x".repeat(32),
  CORS_ORIGINS: "http://localhost:3000",
};

describe("envSchema", () => {
  it.each(["console", "memory"])("refuses MAIL_TRANSPORT=%s in production", (transport) => {
    const result = envSchema.safeParse({
      ...base,
      NODE_ENV: "production",
      MAIL_TRANSPORT: transport,
    });
    expect(result.success).toBe(false);
  });

  it("accepts MAIL_TRANSPORT=disabled in production", () => {
    const result = envSchema.safeParse({
      ...base,
      NODE_ENV: "production",
      MAIL_TRANSPORT: "disabled",
    });
    expect(result.success).toBe(true);
  });

  it("keeps registration off unless enabled", () => {
    expect(envSchema.parse(base).REGISTRATION_ENABLED).toBe(false);
    expect(envSchema.parse({ ...base, REGISTRATION_ENABLED: "true" }).REGISTRATION_ENABLED).toBe(
      true,
    );
  });

  it("refuses TRUST_PROXY=true", () => {
    expect(envSchema.safeParse({ ...base, TRUST_PROXY: "true" }).success).toBe(false);
  });
});
