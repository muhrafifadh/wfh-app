import { inviteUserSchema, updateUserSchema } from "@/features/users/schemas";

const ROLE = "01a11fa3-9fd3-76d3-9390-2bc41e4671d2";

describe("inviteUserSchema", () => {
  it("normalizes the email and trims the name", () => {
    expect(
      inviteUserSchema.parse({ email: " Ada@Example.TEST ", name: "  Ada ", roleId: ROLE }),
    ).toEqual({ email: "ada@example.test", name: "Ada", roleId: ROLE });
  });

  it("asks to choose a role when none is picked", () => {
    const result = inviteUserSchema.safeParse({ email: "a@b.test", name: "A", roleId: "" });
    expect(result.error?.issues.map((i) => i.message)).toEqual(["Choose a role"]);
  });

  it("limits names to 100 characters", () => {
    const at = (n: number) =>
      inviteUserSchema.safeParse({ email: "a@b.test", name: "a".repeat(n), roleId: ROLE }).success;
    expect(at(100)).toBe(true);
    expect(at(101)).toBe(false);
  });
});

describe("updateUserSchema", () => {
  it("requires a name", () => {
    expect(updateUserSchema.safeParse({ name: " ", roleId: ROLE }).success).toBe(false);
  });
});
