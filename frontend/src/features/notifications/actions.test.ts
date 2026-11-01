import {
  markNotificationReadAction,
  updateEmailPreferencesAction,
} from "@/features/notifications/actions";
import { apiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/session";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ apiFetch: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

beforeEach(() => vi.mocked(requireUser).mockResolvedValue({} as never));
afterEach(() => vi.resetAllMocks());

describe("markNotificationReadAction", () => {
  it("rejects something that isn't an id without calling the backend", async () => {
    const result = await markNotificationReadAction("../users");
    expect(result.ok).toBe(false);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("explains a notification that isn't there any more", async () => {
    vi.mocked(apiFetch).mockRejectedValue(new ApiError(404, "NOT_FOUND", "Not found"));
    const result = await markNotificationReadAction("01a19a00-0000-7000-8000-000000000001");
    expect(result).toMatchObject({ ok: false, error: "That notification no longer exists." });
  });
});

describe("updateEmailPreferencesAction", () => {
  const preferences = {
    reviewRequestsEmail: true,
    correctionUpdatesEmail: false,
    checkInReminderEmail: true,
    checkOutReminderEmail: false,
  };

  it("sends all four preferences", async () => {
    vi.mocked(apiFetch).mockResolvedValue(preferences);
    const result = await updateEmailPreferencesAction(preferences);
    expect(result).toEqual({ ok: true, data: preferences });
    expect(apiFetch).toHaveBeenCalledWith(
      "/notifications/preferences",
      expect.objectContaining({ method: "PUT", body: preferences }),
    );
  });

  it("refuses an incomplete set", async () => {
    const result = await updateEmailPreferencesAction({ reviewRequestsEmail: false });
    expect(result.ok).toBe(false);
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
