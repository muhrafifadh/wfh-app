import { formatDayDate } from "@/lib/format";

describe("formatDayDate", () => {
  it("shows the weekday and the table date format", () => {
    expect(formatDayDate("2026-10-30")).toBe("Fri, 30 Oct 2026");
  });
});
