import {
  createDivisionAction,
  deactivateDivisionAction,
  updateDivisionAction,
} from "@/features/divisions/actions";
import { divisionFormSchema } from "@/features/divisions/schemas";
import { apiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/session";
import type { Permission } from "@/types/auth";

vi.mock("@/lib/auth/session", () => ({
  requireUser: vi.fn(),
  can: (user: { permissions: string[] }, permission: string) =>
    user.permissions.includes(permission),
}));
vi.mock("@/lib/api/client", () => ({ apiFetch: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const ID = "01a11fa3-9fd3-76d3-9390-2bc41e4671d2";
const division = {
  id: ID,
  code: "ENG",
  name: "Engineering",
  status: "active" as const,
  activeEmployeeCount: 0,
  createdAt: "2026-10-09T00:00:00.000Z",
  updatedAt: "2026-10-09T00:00:00.000Z",
};

const signedInWith = (permissions: Permission[]) =>
  vi.mocked(requireUser).mockResolvedValue({
    id: "me",
    name: "HR",
    email: "hr@example.test",
    organizationId: "org",
    role: { id: "role", name: "admin_hr" },
    emailVerified: true,
    permissions,
  });

afterEach(() => vi.resetAllMocks());

describe("divisionFormSchema", () => {
  it("accepts its own output", () => {
    const parsed = divisionFormSchema.parse({ code: " eng ", name: " Engineering " });
    expect(divisionFormSchema.parse(parsed)).toEqual(parsed);
  });

  it("trims and uppercases the code", () => {
    expect(divisionFormSchema.parse({ code: " ops-2 ", name: " Operations " })).toEqual({
      code: "OPS-2",
      name: "Operations",
    });
  });

  it.each(["E", "-ENG", "ENG DEV", "x".repeat(33)])("rejects the code %j", (code) => {
    expect(divisionFormSchema.safeParse({ code, name: "Eng" }).success).toBe(false);
  });
});

describe("createDivisionAction", () => {
  it("refuses without division:manage, before calling the backend", async () => {
    signedInWith(["employee:manage"]);
    await expect(createDivisionAction({ code: "ENG", name: "Eng" })).resolves.toMatchObject({
      ok: false,
    });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid input", async () => {
    signedInWith(["division:manage"]);
    const result = await createDivisionAction({ code: "", name: "" });
    expect(result.ok || Object.keys(result.fieldErrors ?? {}).sort()).toEqual(["code", "name"]);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("sends the normalized code", async () => {
    signedInWith(["division:manage"]);
    vi.mocked(apiFetch).mockResolvedValue(division);
    await expect(createDivisionAction({ code: "eng", name: "Engineering" })).resolves.toEqual({
      ok: true,
      data: division,
    });
    expect(vi.mocked(apiFetch).mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: { code: "ENG", name: "Engineering" },
    });
  });

  it("puts a taken code on the code field", async () => {
    signedInWith(["division:manage"]);
    vi.mocked(apiFetch).mockRejectedValue(
      new ApiError(409, "DIVISION_CODE_TAKEN", "raw", {
        fieldErrors: { code: ["Already in use"] },
      }),
    );
    await expect(createDivisionAction({ code: "ENG", name: "Eng" })).resolves.toEqual({
      ok: false,
      error: "Another division already uses this code.",
      fieldErrors: { code: ["Already in use"] },
    });
  });
});

describe("updateDivisionAction", () => {
  it("refuses an id that isn't a UUID", async () => {
    signedInWith(["division:manage"]);
    await expect(updateDivisionAction("nope", { code: "ENG", name: "Eng" })).resolves.toMatchObject(
      { ok: false },
    );
    expect(apiFetch).not.toHaveBeenCalled();
  });
});

describe("deactivateDivisionAction", () => {
  it("explains a division that still has active employees", async () => {
    signedInWith(["division:manage"]);
    vi.mocked(apiFetch).mockRejectedValue(
      new ApiError(409, "DIVISION_HAS_ACTIVE_EMPLOYEES", "raw", { activeEmployeeCount: 2 }),
    );
    await expect(deactivateDivisionAction(ID)).resolves.toEqual({
      ok: false,
      error: "This division still has active employees. Move them to another division first.",
      fieldErrors: undefined,
    });
  });

  it("lets unexpected errors reach the error boundary", async () => {
    signedInWith(["division:manage"]);
    vi.mocked(apiFetch).mockRejectedValue(new ApiError(500, "INTERNAL_ERROR", "boom"));
    await expect(deactivateDivisionAction(ID)).rejects.toThrow("boom");
  });
});
