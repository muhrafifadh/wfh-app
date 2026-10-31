import { createHolidayAction, deleteHolidayAction } from "@/features/holidays/actions";
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

describe("createHolidayAction", () => {
  it("refuses without holiday:manage, before calling the backend", async () => {
    signedInWith(["policy:manage"]);
    await expect(
      createHolidayAction({ date: "2026-12-25", name: "Christmas" }),
    ).resolves.toMatchObject({ ok: false });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("validates the date and name", async () => {
    signedInWith(["holiday:manage"]);
    const result = await createHolidayAction({ date: "25/12/2026", name: " " });
    expect(result.ok || Object.keys(result.fieldErrors ?? {}).sort()).toEqual(["date", "name"]);
  });

  it("shows a date conflict on the date field", async () => {
    signedInWith(["holiday:manage"]);
    vi.mocked(apiFetch).mockRejectedValue(
      new ApiError(409, "HOLIDAY_DATE_CONFLICT", "raw", {
        fieldErrors: { date: ["Already a holiday"] },
      }),
    );
    await expect(createHolidayAction({ date: "2026-12-25", name: "Christmas" })).resolves.toEqual({
      ok: false,
      error: "There's already a holiday on this date.",
      fieldErrors: { date: ["Already a holiday"] },
    });
  });
});

describe("deleteHolidayAction", () => {
  it("deletes through the backend", async () => {
    signedInWith(["holiday:manage"]);
    vi.mocked(apiFetch).mockResolvedValue(undefined);
    await expect(deleteHolidayAction("01a11fa3-9fd3-76d3-9390-2bc41e4671d2")).resolves.toEqual({
      ok: true,
      data: undefined,
    });
    expect(vi.mocked(apiFetch).mock.calls[0]?.[1]).toMatchObject({ method: "DELETE" });
  });
});
