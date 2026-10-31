import { registerSchema, resetPasswordFormSchema } from "@/features/auth/schemas";

describe("auth schemas", () => {
  it("normalizes the email and requires 12+ character passwords on register", () => {
    const ok = registerSchema.safeParse({
      name: "Ada",
      organizationName: "Engines",
      email: "  Ada@Example.TEST ",
      password: "correct-horse",
    });
    expect(ok.success && ok.data.email).toBe("ada@example.test");

    const short = registerSchema.safeParse({
      name: "Ada",
      organizationName: "Engines",
      email: "ada@example.test",
      password: "short",
    });
    expect(short.success).toBe(false);
  });

  it("flags a mismatched confirmation on the confirm field", () => {
    const result = resetPasswordFormSchema.safeParse({
      password: "a-long-new-password",
      confirmPassword: "a-different-password",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["confirmPassword"]);
  });
});
