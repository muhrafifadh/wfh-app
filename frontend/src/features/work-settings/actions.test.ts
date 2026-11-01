import {
  createScheduleAction,
  updateOrganizationSettingsAction,
  updateReminderSettingsAction,
} from "@/features/work-settings/actions";
import { organizationSettingsSchema, scheduleFormSchema } from "@/features/work-settings/schemas";
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

const baseline = {
  name: "Standard",
  timezone: "Asia/Jakarta",
  workingDays: [5, 1, 2, 3, 4],
  startTime: "09:00",
  endTime: "17:00",
  toleranceMinutes: "15",
  checkInOpensAt: "08:00",
  checkInClosesAt: "17:00",
  checkOutDeadline: "23:59",
  effectiveFrom: "2026-11-03",
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

describe("scheduleFormSchema", () => {
  // The Server Action re-validates what the form already parsed
  it("accepts its own output", () => {
    const parsed = scheduleFormSchema.parse(baseline);
    expect(scheduleFormSchema.parse(parsed)).toEqual(parsed);
  });

  it("sends the baseline the way the backend stores it", () => {
    expect(scheduleFormSchema.parse(baseline)).toEqual({
      ...baseline,
      workingDays: [1, 2, 3, 4, 5],
      toleranceMinutes: 15,
      checkOutDeadline: "23:59:59.999",
    });
  });

  it.each([
    [{ checkInOpensAt: "09:30" }, "checkInOpensAt"],
    [{ endTime: "09:00" }, "endTime"],
    [{ checkInClosesAt: "08:00" }, "checkInClosesAt"],
    [{ checkOutDeadline: "16:00" }, "checkOutDeadline"],
    [{ toleranceMinutes: "121" }, "toleranceMinutes"],
    [{ workingDays: [] }, "workingDays"],
  ])("rejects %j on %s", (change, field) => {
    const result = scheduleFormSchema.safeParse({ ...baseline, ...change });
    expect(result.success || result.error.issues.map((issue) => issue.path[0])).toContain(field);
  });
});

describe("organizationSettingsSchema", () => {
  it("accepts its own output", () => {
    for (const supportContact of ["", "hr@example.test"]) {
      const parsed = organizationSettingsSchema.parse({ supportContact, retentionYears: "5" });
      expect(organizationSettingsSchema.parse(parsed)).toEqual(parsed);
    }
  });

  it("clears a blank support contact and reads the years as a number", () => {
    expect(organizationSettingsSchema.parse({ supportContact: "  ", retentionYears: "5" })).toEqual(
      {
        supportContact: null,
        retentionYears: 5,
      },
    );
  });
});

describe("createScheduleAction", () => {
  it("refuses without policy:manage, before calling the backend", async () => {
    signedInWith(["holiday:manage"]);
    await expect(createScheduleAction(baseline)).resolves.toMatchObject({ ok: false });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("puts a too-early date on the date field", async () => {
    signedInWith(["policy:manage"]);
    vi.mocked(apiFetch).mockRejectedValue(
      new ApiError(422, "SCHEDULE_EFFECTIVE_DATE_TOO_EARLY", "raw", {
        fieldErrors: { effectiveFrom: ["Use 2026-11-03 or later"] },
      }),
    );
    await expect(createScheduleAction(baseline)).resolves.toEqual({
      ok: false,
      error: "A new schedule can start tomorrow at the earliest (organization time).",
      fieldErrors: { effectiveFrom: ["Use 2026-11-03 or later"] },
    });
  });
});

describe("updateOrganizationSettingsAction", () => {
  it("rejects retention outside 1–10 years", async () => {
    signedInWith(["policy:manage"]);
    const result = await updateOrganizationSettingsAction({
      supportContact: "",
      retentionYears: "11",
    });
    expect(result.ok || Object.keys(result.fieldErrors ?? {})).toEqual(["retentionYears"]);
    expect(apiFetch).not.toHaveBeenCalled();
  });
});

describe("updateReminderSettingsAction", () => {
  const reminders = {
    checkInReminderEnabled: true,
    checkInReminderTime: "09:30",
    checkOutReminderEnabled: false,
    checkOutReminderTime: "18:00",
  };

  it("sends all four reminder fields", async () => {
    signedInWith(["policy:manage"]);
    vi.mocked(apiFetch).mockResolvedValue({});
    await updateReminderSettingsAction(reminders);
    expect(apiFetch).toHaveBeenCalledWith(
      "/work-settings",
      expect.objectContaining({ method: "PATCH", body: reminders }),
    );
  });

  it("rejects a malformed time before calling the backend", async () => {
    signedInWith(["policy:manage"]);
    const result = await updateReminderSettingsAction({
      ...reminders,
      checkInReminderTime: "9:30",
    });
    expect(result.ok || Object.keys(result.fieldErrors ?? {})).toEqual(["checkInReminderTime"]);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("needs policy:manage", async () => {
    signedInWith(["attendance:self"]);
    const result = await updateReminderSettingsAction(reminders);
    expect(result.ok).toBe(false);
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
