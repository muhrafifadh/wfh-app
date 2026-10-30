import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";

import { checkInAction, checkOutAction } from "@/features/attendance/actions";
import { TodayCard } from "@/features/attendance/components/today-card";
import { aRecord, aToday } from "@/features/attendance/fixtures";
import type { Today } from "@/features/attendance/schemas";
import { ok } from "@/lib/actions";

vi.mock("@/features/attendance/actions", () => ({
  checkInAction: vi.fn(),
  checkOutAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const checkedIn = aToday({
  serverTime: "2026-10-30T01:57:01.000Z",
  state: "checked_in",
  canCheckIn: false,
  canCheckOut: true,
  record: aRecord(),
});

/** The route handler behind the card's re-checks (app/api/attendance/today). */
const serveToday = (...responses: (Today | Error)[]) => {
  const fetchMock = vi.fn();
  for (const response of responses) {
    fetchMock.mockImplementationOnce(async () =>
      response instanceof Error
        ? Promise.reject(response)
        : new Response(JSON.stringify(response), { status: 200 }),
    );
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

function renderCard(today: Today | null = aToday()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TodayCard
        initialToday={today}
        supportContact={<a href="mailto:hr@example.test">hr@example.test</a>}
      />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

describe("TodayCard", () => {
  it("shows the date, organization time, schedule and status", () => {
    renderCard();
    expect(screen.getByText("Friday, 30 October 2026")).toBeInTheDocument();
    expect(screen.getByText("08:52:14 WIB")).toBeInTheDocument();
    expect(screen.getByText(/09:00–17:00 WIB · 15 min tolerance/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Not checked in" })).toBeInTheDocument();
  });

  it("keeps Check in disabled until the server allows it", () => {
    renderCard(aToday({ state: "before_window", canCheckIn: false }));
    expect(screen.getByRole("button", { name: "Check in" })).toBeDisabled();
  });

  it("records one check-in however often it's clicked, and confirms only after the server", async () => {
    let finish: (value: Awaited<ReturnType<typeof checkInAction>>) => void = () => {};
    vi.mocked(checkInAction).mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    const user = userEvent.setup();
    renderCard();

    const button = screen.getByRole("button", { name: "Check in" });
    await user.click(button);
    await user.click(button);
    expect(await screen.findByRole("button", { name: "Recording check-in…" })).toBeDisabled();
    expect(screen.queryByRole("heading", { name: "Checked in" })).not.toBeInTheDocument();

    finish(
      ok({
        kind: "recorded",
        at: aRecord().checkInAt ?? "",
        timezone: "Asia/Jakarta",
        today: checkedIn,
      }),
    );
    const heading = await screen.findByRole("heading", { name: "Checked in" });
    expect(checkInAction).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("Checked in at 08:57:00 WIB.");
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it("after an unconfirmed result, checks the state first, then retries with the same key", async () => {
    vi.mocked(checkInAction).mockResolvedValue(
      ok({
        kind: "unconfirmed",
        message: "We couldn't confirm the result. Checking your status…",
        requestId: "req-9",
      }),
    );
    const fetchMock = serveToday(aToday({ serverTime: "2026-10-30T01:58:00.000Z" }));
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole("button", { name: "Check in" }));
    expect(
      await screen.findByText("Your check-in wasn't recorded. Try again."),
    ).toBeInTheDocument();
    expect(screen.getByText("Reference: req-9")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/attendance/today", expect.anything());

    await user.click(screen.getByRole("button", { name: "Check in" }));
    const [first, second] = vi.mocked(checkInAction).mock.calls.map(([key]) => key);
    expect(second).toBe(first);
  });

  it("after an unconfirmed result that was in fact recorded, says so instead of offering a retry", async () => {
    vi.mocked(checkInAction).mockResolvedValue(
      ok({
        kind: "unconfirmed",
        message: "We couldn't confirm the result. Checking your status…",
        requestId: null,
      }),
    );
    serveToday(checkedIn);
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole("button", { name: "Check in" }));
    expect(await screen.findByRole("heading", { name: "Checked in" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Checked in at 08:57:00 WIB.");
    expect(screen.getByRole("button", { name: "Check out" })).toBeEnabled();
  });

  it("offers no new action while the state can't be re-checked", async () => {
    vi.mocked(checkInAction).mockRejectedValue(new TypeError("Failed to fetch"));
    serveToday(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole("button", { name: "Check in" }));
    expect(await screen.findByText(/We still can't reach the server/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Check in" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check my status" })).toBeInTheDocument();
  });

  it("shows a rejection in approved copy with the refreshed state", async () => {
    vi.mocked(checkInAction).mockResolvedValue(
      ok({
        kind: "rejected",
        message: "Today's check-in window has closed.",
        today: aToday({ state: "window_closed", canCheckIn: false }),
      }),
    );
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole("button", { name: "Check in" }));
    expect(
      await screen.findByRole("heading", { name: "Today's check-in window has closed" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Today's check-in window has closed.");
  });

  it("asks before checking out", async () => {
    vi.mocked(checkOutAction).mockResolvedValue(
      ok({
        kind: "recorded",
        at: "2026-10-30T10:39:00.000Z",
        timezone: "Asia/Jakarta",
        today: null,
      }),
    );
    serveToday(
      aToday({
        serverTime: "2026-10-30T10:39:01.000Z",
        state: "checked_out",
        canCheckIn: false,
        record: aRecord({
          checkOutAt: "2026-10-30T10:39:00.000Z",
          completion: "complete",
          workedMinutes: 462,
        }),
      }),
    );
    const user = userEvent.setup();
    renderCard(checkedIn);

    await user.click(screen.getByRole("button", { name: "Check out" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Finish today's attendance?" });
    expect(dialog).toHaveTextContent("You checked in at 08:57:00 WIB.");
    expect(checkOutAction).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Yes, check out" }));
    expect(await screen.findByRole("heading", { name: "Done for today" })).toBeInTheDocument();
    expect(checkOutAction).toHaveBeenCalledTimes(1);
  });

  it("K: without any state, says so and offers Try again", () => {
    serveToday(new TypeError("Failed to fetch"));
    renderCard(null);
    expect(
      screen.getByText("We couldn't load your attendance status. Try again."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("J: contact Admin/HR, with the support contact", () => {
    renderCard(aToday({ state: "no_profile", canCheckIn: false, employee: null, schedule: null }));
    expect(screen.getByRole("link", { name: "hr@example.test" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("has no automated accessibility violations", async () => {
    const { container } = renderCard(checkedIn);
    const result = await axe.run(container, {
      runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
      rules: { "color-contrast": { enabled: false } },
    });
    expect(result.violations.map((v) => v.id)).toEqual([]);
  });
});
