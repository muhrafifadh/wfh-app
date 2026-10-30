import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";

import {
  approveCorrectionAction,
  previewCorrectionAction,
  rejectCorrectionAction,
} from "@/features/corrections/actions";
import { CorrectionComparison } from "@/features/corrections/components/correction-comparison";
import { CorrectionRequestForm } from "@/features/corrections/components/correction-request-form";
import { DecisionPanel } from "@/features/corrections/components/decision-panel";
import { aCorrection } from "@/features/corrections/fixtures";
import { fail, ok } from "@/lib/actions";

vi.mock("@/features/corrections/actions", () => ({
  approveCorrectionAction: vi.fn(),
  rejectCorrectionAction: vi.fn(),
  previewCorrectionAction: vi.fn(),
  submitCorrectionAction: vi.fn(),
}));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh, back: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

async function violations(container: Element) {
  const result = await axe.run(container, {
    runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
    rules: { "color-contrast": { enabled: false } },
  });
  return result.violations.map((v) => v.id);
}

afterEach(() => vi.resetAllMocks());

describe("CorrectionComparison (UX_FLOWS.md §9.4)", () => {
  it("shows current and proposed times, status and duration, marking what changes", () => {
    render(<CorrectionComparison {...aCorrection()} />);
    const row = (label: string) => within(screen.getByRole("row", { name: new RegExp(label) }));
    expect(row("Check-in").getByText("09:42")).toBeInTheDocument();
    expect(row("Check-in").getByText("08:58")).toBeInTheDocument();
    expect(row("Check-out").getByText("—")).toBeInTheDocument();
    expect(row("Check-out").getByText("17:10")).toBeInTheDocument();
    expect(row("Status").getByText("Late")).toBeInTheDocument();
    expect(row("Status").getByText("Present")).toBeInTheDocument();
    expect(row("Duration").getByText("8h 12m")).toBeInTheDocument();
    expect(screen.getAllByText("(changed)")).toHaveLength(5);
  });
});

describe("DecisionPanel", () => {
  it("won't reject without a note", async () => {
    const user = userEvent.setup();
    render(<DecisionPanel correction={aCorrection()} />);
    await user.click(screen.getByRole("button", { name: "Reject" }));
    expect(await screen.findByText("Explain why in at least 10 characters")).toBeInTheDocument();
    expect(rejectCorrectionAction).not.toHaveBeenCalled();
  });

  it("asks before approving, then refreshes", async () => {
    vi.mocked(approveCorrectionAction).mockResolvedValue(ok(aCorrection({ status: "approved" })));
    const user = userEvent.setup();
    render(<DecisionPanel correction={aCorrection()} />);
    await user.click(screen.getByRole("button", { name: "Approve" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Approve this correction?" });
    expect(dialog).toHaveTextContent("Agus Pratama's record for this day becomes Present, 8h 12m.");
    expect(approveCorrectionAction).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Yes, approve" }));
    expect(approveCorrectionAction).toHaveBeenCalledWith(aCorrection().id, { decisionNote: "" });
    expect(refresh).toHaveBeenCalled();
  });

  it("shows who decided first when another reviewer got there", async () => {
    vi.mocked(rejectCorrectionAction).mockResolvedValue(
      fail("This request was already approved by Rina Wijaya on Tue, 3 Nov 2026, 10:15 WIB."),
    );
    const user = userEvent.setup();
    render(<DecisionPanel correction={aCorrection()} />);
    await user.type(
      screen.getByLabelText("Note to the employee"),
      "No evidence of work before 10:00.",
    );
    await user.click(screen.getByRole("button", { name: "Reject" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already approved by Rina Wijaya");
  });

  it("has no automated accessibility violations", async () => {
    const { container } = render(<DecisionPanel correction={aCorrection()} />);
    expect(await violations(container)).toEqual([]);
  });
});

describe("CorrectionRequestForm (UX_FLOWS.md §9.1)", () => {
  const props = {
    attendanceId: aCorrection().attendanceId,
    workDate: "2026-11-02",
    timezone: "Asia/Jakarta",
    current: { checkInAt: "2026-11-02T02:42:00.000Z", checkOutAt: null },
    deadline: "Monday, 9 November 2026",
  };

  it("previews the server's result when a time field is left", async () => {
    const correction = aCorrection();
    vi.mocked(previewCorrectionAction).mockResolvedValue(
      ok({
        attendanceId: correction.attendanceId,
        workDate: correction.workDate,
        timezone: correction.timezone,
        submissionClosesAt: "2026-11-09T16:59:59.999Z",
        current: correction.current,
        requested: correction.requested,
        changes: correction.changes,
        outcome: correction.outcome,
      }),
    );
    const user = userEvent.setup();
    render(<CorrectionRequestForm {...props} />);
    expect(screen.getByText("Leave blank to keep 09:42 WIB.")).toBeInTheDocument();
    expect(screen.getByText(/until Monday, 9 November 2026/)).toBeInTheDocument();

    await user.type(screen.getByLabelText("Proposed check-in (WIB)"), "08:58");
    await user.tab();
    expect(await screen.findByText("8h 12m")).toBeInTheDocument();
    expect(previewCorrectionAction).toHaveBeenCalledTimes(1);
  });

  it("has no automated accessibility violations", async () => {
    const { container } = render(<CorrectionRequestForm {...props} />);
    expect(await violations(container)).toEqual([]);
  });
});
