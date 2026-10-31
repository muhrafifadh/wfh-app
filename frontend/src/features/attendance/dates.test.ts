import {
  addDays,
  canRequestCorrection,
  historyMonth,
  historyRange,
  isIsoDate,
  lastDayOf,
  monthWeeks,
  shiftMonth,
} from "@/features/attendance/dates";

describe("calendar arithmetic", () => {
  it("accepts only real dates", () => {
    expect(isIsoDate("2026-10-30")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("30/10/2026")).toBe(false);
  });

  it("adds days and months across year ends", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(lastDayOf("2028-02")).toBe("2028-02-29");
  });

  it("lays a month out in Monday-first weeks", () => {
    // October 2026 starts on a Thursday and ends on a Saturday
    const weeks = monthWeeks("2026-10");
    expect(weeks[0]).toEqual([
      null,
      null,
      null,
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ]);
    expect(weeks.at(-1)).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      null,
    ]);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
  });
});

describe("historyRange", () => {
  const today = "2026-10-30";

  it("defaults to the current month", () => {
    expect(historyRange({ from: "", to: "" }, today)).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
    });
  });

  it("refuses bad, reversed and over-long ranges before any request", () => {
    expect(historyRange({ from: "2026-13-01", to: "" }, today)).toHaveProperty("error");
    expect(historyRange({ from: "2026-10-20", to: "2026-10-01" }, today)).toEqual({
      error: "The end date must be on or after the start date.",
    });
    expect(historyRange({ from: "2025-01-01", to: "2026-10-30" }, today)).toEqual({
      error: "Choose a range of at most 366 days.",
    });
    expect(historyRange({ from: "2025-10-30", to: "2026-10-30" }, today)).toEqual({
      from: "2025-10-30",
      to: "2026-10-30",
    });
  });

  it("falls back to the current month for a bad month", () => {
    expect(historyMonth("2026-9", today)).toBe("2026-10");
    expect(historyMonth("2026-09", today)).toBe("2026-09");
  });
});

describe("canRequestCorrection", () => {
  const record = { workDate: "2026-10-23", pendingCorrectionId: null };

  it("is open through the seventh day after the work date", () => {
    expect(canRequestCorrection(record, "2026-10-23")).toBe(true);
    expect(canRequestCorrection(record, "2026-10-30")).toBe(true);
    expect(canRequestCorrection(record, "2026-10-31")).toBe(false);
  });

  it("is closed while a request is pending", () => {
    expect(canRequestCorrection({ ...record, pendingCorrectionId: "c1" }, "2026-10-24")).toBe(
      false,
    );
  });
});
