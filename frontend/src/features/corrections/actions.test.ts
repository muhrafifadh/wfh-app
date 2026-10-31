import {
  approveCorrectionAction,
  previewCorrectionAction,
  rejectCorrectionAction,
  submitCorrectionAction,
} from "@/features/corrections/actions";
import { aCorrection } from "@/features/corrections/fixtures";
import { getCorrection } from "@/features/corrections/queries";
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
vi.mock("@/features/corrections/queries", () => ({ getCorrection: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const signedInWith = (permissions: Permission[]) =>
  vi.mocked(requireUser).mockResolvedValue({
    id: "me",
    name: "Agus",
    email: "agus@example.test",
    organizationId: "org",
    role: { id: "role", name: "employee" },
    emailVerified: true,
    permissions,
  });

const proposal = {
  attendanceId: "01a18c63-0bc9-7548-a089-70b591453337",
  workDate: "2026-11-02",
  timezone: "Asia/Jakarta",
  checkIn: "08:58",
  checkOut: "",
};

beforeEach(() => signedInWith(["correction:submit", "correction:decide_team"]));
afterEach(() => vi.resetAllMocks());

describe("previewCorrectionAction", () => {
  it("sends instants on the work date in the record's zone, and only what's proposed", async () => {
    vi.mocked(apiFetch).mockResolvedValue({});
    await previewCorrectionAction(proposal);
    expect(vi.mocked(apiFetch).mock.calls[0]).toEqual([
      "/correction-requests/preview",
      expect.objectContaining({
        method: "POST",
        body: {
          attendanceId: proposal.attendanceId,
          requestedCheckInAt: "2026-11-02T08:58:00+07:00",
        },
      }),
    ]);
  });

  it("puts the backend's field errors on the form's fields", async () => {
    vi.mocked(apiFetch).mockRejectedValue(
      new ApiError(422, "CORRECTION_TIMES_INVALID", "raw", {
        fieldErrors: { requestedCheckOutAt: ["Must be at or after the check-in"] },
      }),
    );
    await expect(
      previewCorrectionAction({ ...proposal, checkOut: "08:00", checkIn: "" }),
    ).resolves.toEqual({
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: { checkOut: ["Must be at or after the check-in"] },
    });
  });

  it("refuses an empty proposal before calling the backend", async () => {
    const result = await previewCorrectionAction({ ...proposal, checkIn: "", checkOut: "" });
    expect(result.ok || result.fieldErrors).toHaveProperty("checkIn");
    expect(apiFetch).not.toHaveBeenCalled();
  });
});

describe("submitCorrectionAction", () => {
  it("refuses without correction:submit", async () => {
    signedInWith([]);
    await expect(
      submitCorrectionAction({ ...proposal, reason: "Long enough reason" }),
    ).resolves.toMatchObject({ ok: false });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("needs a reason of 10 characters", async () => {
    const result = await submitCorrectionAction({ ...proposal, reason: " short " });
    expect(result.ok || result.fieldErrors).toHaveProperty("reason");
  });

  it("maps a pending request to approved copy", async () => {
    vi.mocked(apiFetch).mockRejectedValue(new ApiError(409, "CORRECTION_ALREADY_PENDING", "raw"));
    await expect(
      submitCorrectionAction({ ...proposal, reason: "Long enough reason" }),
    ).resolves.toEqual({
      ok: false,
      error: "A correction for this day is already pending.",
      fieldErrors: undefined,
    });
  });
});

describe("deciding", () => {
  const id = aCorrection().id;

  it("requires a note to reject, before calling the backend", async () => {
    const result = await rejectCorrectionAction(id, { decisionNote: "no" });
    expect(result.ok || result.fieldErrors).toHaveProperty("decisionNote");
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("approves without a note (an empty note isn't sent)", async () => {
    vi.mocked(apiFetch).mockResolvedValue(aCorrection({ status: "approved" }));
    await expect(approveCorrectionAction(id, { decisionNote: "" })).resolves.toMatchObject({
      ok: true,
    });
    expect(vi.mocked(apiFetch).mock.calls[0]?.[1]).toMatchObject({ body: {} });
  });

  it("says who decided first, instead of applying a second decision", async () => {
    vi.mocked(apiFetch).mockRejectedValue(new ApiError(409, "CORRECTION_ALREADY_DECIDED", "raw"));
    vi.mocked(getCorrection).mockResolvedValue(
      aCorrection({
        status: "rejected",
        decision: {
          decidedBy: { id: "01a11fa4-1b5f-7d2e-8b88-1e6c2e5d3f99", name: "Indah Permata" },
          decidedAt: "2026-11-03T03:15:00.000Z",
          note: "No evidence",
        },
      }),
    );
    await expect(approveCorrectionAction(id, {})).resolves.toEqual({
      ok: false,
      error: "This request was already rejected by Indah Permata on Tue, 3 Nov 2026, 10:15 WIB.",
      fieldErrors: undefined,
    });
  });

  it("maps a self-approval attempt", async () => {
    vi.mocked(apiFetch).mockRejectedValue(
      new ApiError(403, "CORRECTION_SELF_APPROVAL_FORBIDDEN", "raw"),
    );
    await expect(approveCorrectionAction(id, {})).resolves.toMatchObject({
      ok: false,
      error: "You can't decide your own request.",
    });
  });
});
