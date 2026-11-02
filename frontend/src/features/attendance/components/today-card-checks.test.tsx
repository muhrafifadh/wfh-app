import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { checkInAction, checkOutAction } from "@/features/attendance/actions";
import { TodayCard } from "@/features/attendance/components/today-card";
import { aRecord, aToday } from "@/features/attendance/fixtures";
import type { Today } from "@/features/attendance/schemas";
import { acknowledgeNoticeAction } from "@/features/attendance-verification/actions";
import type { MyVerification } from "@/features/attendance-verification/schemas";
import { ok } from "@/lib/actions";

const EVIDENCE = { location: { latitude: -6.2, longitude: 106.8, accuracyMeters: 20 } };

vi.mock("@/features/attendance/actions", () => ({
  checkInAction: vi.fn(),
  checkOutAction: vi.fn(),
}));
vi.mock("@/features/attendance-verification/actions", () => ({
  acknowledgeNoticeAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/features/attendance-verification/components/capture-dialog", () => ({
  CaptureDialog: ({
    open,
    moment,
    onCaptured,
    onOpenChange,
  }: {
    open: boolean;
    moment: string;
    onCaptured: (evidence: typeof EVIDENCE) => void;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <div role="dialog" aria-label={`Capture ${moment}`}>
        <button onClick={() => onCaptured(EVIDENCE)}>Finish capture</button>
        <button onClick={() => onOpenChange(false)}>Close capture</button>
      </div>
    ) : null,
}));

const checks: MyVerification = {
  location: { enabled: true },
  selfie: { enabled: true },
  results: [],
  notice: { version: 3, acknowledged: true },
  workLocation: { approved: null, pending: null },
};
const checkedIn = aToday({
  state: "checked_in",
  canCheckIn: false,
  canCheckOut: true,
  record: aRecord(),
});

function renderCard(today: Today, initialChecks: MyVerification | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <TodayCard initialToday={today} initialChecks={initialChecks} supportContact={null} />
    </QueryClientProvider>,
  );
}

const recorded = (today: Today) =>
  ok({
    kind: "recorded" as const,
    at: "2026-10-30T02:00:00.000Z",
    timezone: "Asia/Jakarta",
    today,
  });

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(checks), { status: 200 })),
  );
});

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

describe("TodayCard with checks on", () => {
  it("records a check-in only after the capture, with its evidence", async () => {
    vi.mocked(checkInAction).mockResolvedValue(recorded(checkedIn));
    renderCard(aToday(), checks);

    await userEvent.click(screen.getByRole("button", { name: "Check in" }));
    expect(checkInAction).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Finish capture" }));
    await waitFor(() => expect(checkInAction).toHaveBeenCalledWith(expect.any(String), EVIDENCE));
  });

  it("shows the attendance checks inside the card", () => {
    renderCard(aToday(), checks);
    expect(screen.getByRole("heading", { name: "Attendance checks" })).toBeInTheDocument();
  });

  it("records nothing when the capture is closed", async () => {
    renderCard(aToday(), checks);
    await userEvent.click(screen.getByRole("button", { name: "Check in" }));
    await userEvent.click(screen.getByRole("button", { name: "Close capture" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(checkInAction).not.toHaveBeenCalled();
  });

  it("takes check-out through the same capture, instead of the confirmation", async () => {
    vi.mocked(checkOutAction).mockResolvedValue(recorded(checkedIn));
    renderCard(checkedIn, checks);

    await userEvent.click(screen.getByRole("button", { name: "Check out" }));
    expect(screen.queryByText("Finish today's attendance?")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Finish capture" }));
    await waitFor(() => expect(checkOutAction).toHaveBeenCalledWith(expect.any(String), EVIDENCE));
  });

  it("shows the notice first when it's unread", async () => {
    vi.mocked(acknowledgeNoticeAction).mockResolvedValue(ok(undefined));
    renderCard(aToday(), { ...checks, notice: { version: 3, acknowledged: false } });

    await userEvent.click(screen.getByRole("button", { name: "Check in" }));
    expect(screen.queryByRole("button", { name: "Finish capture" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "I've read this" }));

    expect(await screen.findByRole("button", { name: "Finish capture" })).toBeInTheDocument();
    expect(checkInAction).not.toHaveBeenCalled();
  });
});

describe("TodayCard with checks off", () => {
  const off = { ...checks, location: { enabled: false }, selfie: { enabled: false } };

  it("checks in straight away, with no evidence", async () => {
    vi.mocked(checkInAction).mockResolvedValue(recorded(checkedIn));
    renderCard(aToday(), off);
    await userEvent.click(screen.getByRole("button", { name: "Check in" }));
    await waitFor(() => expect(checkInAction).toHaveBeenCalledWith(expect.any(String)));
    expect(screen.queryByRole("button", { name: "Finish capture" })).not.toBeInTheDocument();
  });

  it("shows no attendance checks", () => {
    renderCard(aToday(), off);
    expect(screen.queryByRole("heading", { name: "Attendance checks" })).not.toBeInTheDocument();
  });

  it("keeps the check-out confirmation", async () => {
    renderCard(checkedIn, off);
    await userEvent.click(screen.getByRole("button", { name: "Check out" }));
    expect(screen.getByText("Finish today's attendance?")).toBeInTheDocument();
  });
});
