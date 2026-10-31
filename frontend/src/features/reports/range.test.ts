import { reportRange } from "@/features/reports/range";

describe("reportRange", () => {
  const today = "2026-10-30";

  it("defaults to the current month", () => {
    expect(reportRange({ from: "", to: "" }, today)).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
    });
  });

  it("refuses bad, reversed and over-long ranges before any request", () => {
    expect(reportRange({ from: "2026-02-30", to: "" }, today)).toEqual({
      error: "Choose valid dates.",
    });
    expect(reportRange({ from: "2026-10-30", to: "2026-10-01" }, today)).toHaveProperty("error");
    expect(reportRange({ from: "2025-10-29", to: "2026-10-30" }, today)).toEqual({
      error: "Choose a range of at most 366 days.",
    });
    expect(reportRange({ from: "2025-10-30", to: "2026-10-30" }, today)).toEqual({
      from: "2025-10-30",
      to: "2026-10-30",
    });
  });
});
