import { envSchema } from "@/config/env.js";

const base = {
  EMPLOYEE_DATABASE_URL: "postgresql://u:p@localhost:5432/employee",
  ATTENDANCE_DATABASE_URL: "postgresql://u:p@localhost:5432/attendance",
  REDIS_URL: "redis://localhost:6379",
  JWT_ACCESS_SECRET: "x".repeat(32),
  CORS_ORIGINS: "http://localhost:3000",
  S3_BUCKET: "uploads",
};

describe("envSchema", () => {
  it("needs both S3 keys or neither (neither: the SDK uses the instance role)", () => {
    expect(envSchema.safeParse(base).success).toBe(true);
    expect(envSchema.safeParse({ ...base, S3_ACCESS_KEY_ID: "key" }).success).toBe(false);
    expect(
      envSchema.safeParse({ ...base, S3_ACCESS_KEY_ID: "key", S3_SECRET_ACCESS_KEY: "secret" })
        .success,
    ).toBe(true);
  });

  it("accepts only lowercase queue prefixes", () => {
    expect(envSchema.parse(base).QUEUE_PREFIX).toBe("bull");
    expect(envSchema.safeParse({ ...base, QUEUE_PREFIX: "test" }).success).toBe(true);
    expect(envSchema.safeParse({ ...base, QUEUE_PREFIX: "Bad:Prefix" }).success).toBe(false);
  });

  it.each(["console", "memory"])("refuses MAIL_TRANSPORT=%s in production", (transport) => {
    const result = envSchema.safeParse({
      ...base,
      NODE_ENV: "production",
      MAIL_TRANSPORT: transport,
    });
    expect(result.success).toBe(false);
  });

  it("accepts MAIL_TRANSPORT=smtp in production with a URL and sender", () => {
    const result = envSchema.safeParse({
      ...base,
      NODE_ENV: "production",
      MAIL_TRANSPORT: "smtp",
      SMTP_URL: "smtps://user:pass@smtp.example.com:465",
      MAIL_FROM: "Boilerplate <no-reply@example.com>",
    });
    expect(result.success).toBe(true);
  });

  it("requires SMTP_URL and MAIL_FROM for MAIL_TRANSPORT=smtp", () => {
    expect(envSchema.safeParse({ ...base, MAIL_TRANSPORT: "smtp" }).success).toBe(false);
    expect(
      envSchema.safeParse({ ...base, MAIL_TRANSPORT: "smtp", SMTP_URL: "https://smtp.example.com" })
        .success,
    ).toBe(false);
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
