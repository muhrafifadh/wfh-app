import {
  disclosePhotoAction,
  startPhotoUploadAction,
  updateVerificationSettingsAction,
  viewPhotoAction,
} from "@/features/attendance-verification/actions";
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

const ID = "0b7a3c2e-8d61-4f0a-9c4e-5d2b1a7e6f30";
const OFF = { available: true, locationEnabled: false, selfieEnabled: false };
const REASON = "Two documented cases of check-ins from outside the agreed home area.";

const signedInWith = (permissions: Permission[]) =>
  vi.mocked(requireUser).mockResolvedValue({
    id: "me",
    name: "Indah",
    email: "indah@example.test",
    organizationId: "org",
    role: { id: "role", name: "admin_hr" },
    emailVerified: true,
    permissions,
  });

afterEach(() => vi.resetAllMocks());

describe("updateVerificationSettingsAction", () => {
  beforeEach(() => signedInWith(["verification:manage"]));

  it("refuses without verification:manage, before calling the backend", async () => {
    signedInWith(["policy:manage", "attendance:read_all"]);
    const input = { locationEnabled: true, selfieEnabled: false, justification: REASON };
    await expect(updateVerificationSettingsAction(OFF, input)).resolves.toMatchObject({
      ok: false,
    });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("needs a reason to turn a method on", async () => {
    const result = await updateVerificationSettingsAction(OFF, {
      locationEnabled: true,
      selfieEnabled: false,
      justification: "because",
    });
    expect(result).toMatchObject({
      ok: false,
      fieldErrors: { justification: [expect.any(String)] },
    });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("sends the reason only when turning something on", async () => {
    const on = { ...OFF, locationEnabled: true };
    vi.mocked(apiFetch).mockResolvedValue(OFF);
    await updateVerificationSettingsAction(on, {
      locationEnabled: false,
      selfieEnabled: false,
      justification: "",
    });
    expect(apiFetch).toHaveBeenCalledWith("/attendance-verification/settings", {
      method: "PATCH",
      body: { locationEnabled: false, selfieEnabled: false },
      schema: expect.anything(),
    });
  });

  it("explains when the deployment doesn't allow checks", async () => {
    vi.mocked(apiFetch).mockRejectedValue(
      new ApiError(409, "VERIFICATION_NOT_AVAILABLE", "Not available"),
    );
    const result = await updateVerificationSettingsAction(OFF, {
      locationEnabled: true,
      selfieEnabled: false,
      justification: REASON,
    });
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("aren't available") });
  });
});

describe("startPhotoUploadAction", () => {
  beforeEach(() => signedInWith(["attendance:self"]));

  it("asks for an upload for that moment", async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      uploadUrl: "https://storage.test/x",
      uploadHeaders: {},
    });
    const body = { moment: "check_out", contentType: "image/jpeg", size: 100 };
    const result = await startPhotoUploadAction(body);
    expect(apiFetch).toHaveBeenCalledWith("/attendance-verification/photo-upload", {
      method: "POST",
      body,
      schema: expect.anything(),
    });
    expect(result).toMatchObject({ ok: true });
  });

  it("rejects extra fields before calling the backend", async () => {
    const result = await startPhotoUploadAction({
      moment: "check_in",
      contentType: "image/jpeg",
      size: 100,
      employeeId: "someone-else",
    });
    expect(result).toMatchObject({ ok: false });
    expect(apiFetch).not.toHaveBeenCalled();
  });
});

describe("photo access", () => {
  it("needs verification:read_photo to view, even with verification:manage", async () => {
    signedInWith(["verification:manage", "attendance:read_all"]);
    await expect(viewPhotoAction(ID)).resolves.toMatchObject({ ok: false });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("needs an identity check before disclosing", async () => {
    signedInWith(["verification:read_photo"]);
    const result = await disclosePhotoAction(ID, { identityCheck: "" });
    expect(result).toMatchObject({
      ok: false,
      fieldErrors: { identityCheck: [expect.any(String)] },
    });
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
