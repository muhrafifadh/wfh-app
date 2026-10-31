import { checkInAction, checkOutAction } from "@/features/attendance/actions";
import { aRecord, aToday } from "@/features/attendance/fixtures";
import { getToday } from "@/features/attendance/queries";
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
vi.mock("@/features/attendance/queries", () => ({ getToday: vi.fn() }));
vi.mock("@/lib/logger", () => ({ reportError: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const KEY = "0b7a3c2e-8d61-4f0a-9c4e-5d2b1a7e6f30";

const signedInWith = (permissions: Permission[]) =>
  vi.mocked(requireUser).mockResolvedValue({
    id: "me",
    name: "Rina",
    email: "rina@example.test",
    organizationId: "org",
    role: { id: "role", name: "employee" },
    emailVerified: true,
    permissions,
  });

beforeEach(() => signedInWith(["attendance:self"]));
afterEach(() => vi.resetAllMocks());

describe("checkInAction", () => {
  it("refuses without attendance:self, before calling the backend", async () => {
    signedInWith([]);
    await expect(checkInAction(KEY)).resolves.toMatchObject({ ok: false });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("refuses a malformed idempotency key", async () => {
    await expect(checkInAction("not-a-uuid")).resolves.toMatchObject({ ok: false });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("sends only the idempotency key: no body, no client time", async () => {
    vi.mocked(apiFetch).mockResolvedValue(aRecord());
    const today = aToday({
      state: "checked_in",
      canCheckIn: false,
      canCheckOut: true,
      record: aRecord(),
    });
    vi.mocked(getToday).mockResolvedValue(today);

    await expect(checkInAction(KEY)).resolves.toEqual({
      ok: true,
      data: { kind: "recorded", at: aRecord().checkInAt, timezone: "Asia/Jakarta", today },
    });
    const [path, init] = vi.mocked(apiFetch).mock.calls[0] ?? [];
    expect(path).toBe("/attendance/check-in");
    expect(init).toMatchObject({ method: "POST", headers: { "Idempotency-Key": KEY } });
    expect(init).not.toHaveProperty("body");
  });

  it("maps a rejection to approved copy and returns the fresh state", async () => {
    vi.mocked(apiFetch).mockRejectedValue(
      new ApiError(422, "CHECK_IN_TOO_EARLY", "raw backend text", {
        opensAt: "2026-10-30T01:00:00.000Z",
      }),
    );
    const today = aToday({ state: "before_window", canCheckIn: false });
    vi.mocked(getToday).mockResolvedValue(today);

    await expect(checkInAction(KEY)).resolves.toEqual({
      ok: true,
      data: { kind: "rejected", message: "Check-in opens at 08:00 WIB.", today },
    });
  });

  it.each([
    [
      "a server error",
      new ApiError(503, "SERVICE_UNAVAILABLE", "down", undefined, "req-1"),
      "req-1",
    ],
    ["a lost response", new TypeError("fetch failed"), null],
    ["a timeout", new DOMException("timed out", "TimeoutError"), null],
  ])("treats %s as unconfirmed, without guessing", async (_, error, requestId) => {
    vi.mocked(apiFetch).mockRejectedValue(error);
    await expect(checkInAction(KEY)).resolves.toEqual({
      ok: true,
      data: { kind: "unconfirmed", message: expect.any(String), requestId },
    });
    expect(getToday).not.toHaveBeenCalled();
  });

  it("rethrows codes it has no copy for", async () => {
    vi.mocked(apiFetch).mockRejectedValue(new ApiError(400, "VALIDATION_FAILED", "raw"));
    vi.mocked(getToday).mockResolvedValue(aToday());
    await expect(checkInAction(KEY)).rejects.toThrow(ApiError);
  });
});

describe("checkOutAction", () => {
  it("returns the check-out time once recorded", async () => {
    const record = aRecord({
      checkOutAt: "2026-10-30T10:39:00.000Z",
      completion: "complete",
      workedMinutes: 462,
    });
    vi.mocked(apiFetch).mockResolvedValue(record);
    vi.mocked(getToday).mockRejectedValue(new TypeError("fetch failed"));

    await expect(checkOutAction(KEY)).resolves.toEqual({
      ok: true,
      data: { kind: "recorded", at: record.checkOutAt, timezone: "Asia/Jakarta", today: null },
    });
    expect(vi.mocked(apiFetch).mock.calls[0]?.[0]).toBe("/attendance/check-out");
  });

  it("maps an already-recorded check-out", async () => {
    vi.mocked(apiFetch).mockRejectedValue(
      new ApiError(409, "ATTENDANCE_ALREADY_CHECKED_OUT", "raw"),
    );
    vi.mocked(getToday).mockResolvedValue(aToday({ state: "checked_out" }));
    await expect(checkOutAction(KEY)).resolves.toMatchObject({
      ok: true,
      data: { kind: "rejected", message: "Your check-out is already recorded." },
    });
  });
});
