import { deactivateUserAction, inviteUserAction } from "@/features/users/actions";
import { apiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/session";
import type { Permission } from "@/types/auth";

// System boundaries: the session (cookies + backend), the backend client, and Next's cache.
vi.mock("@/lib/auth/session", () => ({
  requireUser: vi.fn(),
  can: (user: { permissions: string[] }, permission: string) =>
    user.permissions.includes(permission),
}));
vi.mock("@/lib/api/client", () => ({ apiFetch: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const ROLE = "01a11fa3-9fd3-76d3-9390-2bc41e4671d2";
const USER = "01a11fa3-c92d-721c-83e0-70bf24e76653";
const invite = { email: "grace@example.test", name: "Grace", roleId: ROLE };
const invited = {
  id: USER,
  email: "grace@example.test",
  name: "Grace",
  role: { id: ROLE, name: "member" },
  status: "invited" as const,
  emailVerified: false,
  createdAt: "2026-10-09T00:00:00.000Z",
  updatedAt: "2026-10-09T00:00:00.000Z",
};

const signedInWith = (permissions: Permission[]) =>
  vi.mocked(requireUser).mockResolvedValue({
    id: "me",
    name: "Admin",
    email: "admin@example.test",
    organizationId: "org",
    emailVerified: true,
    permissions,
  });

describe("inviteUserAction", () => {
  afterEach(() => vi.resetAllMocks());

  it("rejects callers without a session", async () => {
    vi.mocked(requireUser).mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(inviteUserAction(invite)).rejects.toThrow("NEXT_REDIRECT");
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("refuses without user:manage, before calling the backend", async () => {
    signedInWith(["user:read"]);
    await expect(inviteUserAction(invite)).resolves.toMatchObject({ ok: false });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid input", async () => {
    signedInWith(["user:manage"]);
    const result = await inviteUserAction({ ...invite, email: "nope" });
    expect(result.ok || Object.keys(result.fieldErrors ?? {})).toEqual(["email"]);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("invites through the backend", async () => {
    signedInWith(["user:manage"]);
    vi.mocked(apiFetch).mockResolvedValue(invited);
    await expect(inviteUserAction(invite)).resolves.toEqual({ ok: true, data: invited });
    expect(vi.mocked(apiFetch).mock.calls[0]?.[0]).toBe("/users");
  });

  it("explains a taken email next to the field", async () => {
    signedInWith(["user:manage"]);
    vi.mocked(apiFetch).mockRejectedValue(
      new ApiError(409, "EMAIL_TAKEN", "taken", { fieldErrors: { email: ["Already registered"] } }),
    );
    await expect(inviteUserAction(invite)).resolves.toEqual({
      ok: false,
      error: "An account with this email already exists.",
      fieldErrors: { email: ["Already registered"] },
    });
  });
});

describe("deactivateUserAction", () => {
  afterEach(() => vi.resetAllMocks());

  it("rejects an id that isn't a UUID without calling the backend", async () => {
    signedInWith(["user:manage"]);
    await expect(deactivateUserAction("../../auth/logout")).resolves.toMatchObject({ ok: false });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("passes on the backend's reason for refusing", async () => {
    signedInWith(["user:manage"]);
    vi.mocked(apiFetch).mockRejectedValue(
      new ApiError(422, "CANNOT_CHANGE_OWN_ACCOUNT", "You can't deactivate your own account."),
    );
    await expect(deactivateUserAction(USER)).resolves.toEqual({
      ok: false,
      error: "You can't deactivate your own account.",
      fieldErrors: undefined,
    });
  });
});
