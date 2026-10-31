import { aRecord, SCHEDULE } from "@/features/attendance/fixtures";
import {
  durationLabel,
  formatClock,
  formatDuration,
  formatLongDate,
  greeting,
  lateMessage,
  scheduleLine,
  timesLine,
} from "@/features/attendance/format";

describe("attendance formats (UX_FLOWS.md §3.4)", () => {
  it("formats dates, times and durations", () => {
    expect(formatLongDate("2026-10-30")).toBe("Friday, 30 October 2026");
    expect(formatClock("2026-10-30T02:15:00.000Z", "Asia/Jakarta")).toBe("09:15:00 WIB");
    expect(formatDuration(462)).toBe("7h 42m");
    expect(formatDuration(480)).toBe("8h 00m");
    expect(formatDuration(45)).toBe("45m");
  });

  it("describes the schedule", () => {
    expect(scheduleLine(SCHEDULE)).toBe("09:00–17:00 WIB · 15 min tolerance");
  });

  it("states lateness from the API's minutes, against the deadline", () => {
    expect(lateMessage(aRecord({ status: "late", lateMinutes: 7 }))).toBe(
      "Checked in 7 minutes after the 09:15 WIB deadline.",
    );
    expect(lateMessage(aRecord({ status: "late", lateMinutes: 1 }))).toBe(
      "Checked in 1 minute after the 09:15 WIB deadline.",
    );
  });

  it("never invents a duration for open or absent records", () => {
    expect(durationLabel(aRecord())).toBe("Not checked out");
    expect(durationLabel(aRecord({ incomplete: true }))).toBe("Missing check-out");
    expect(
      durationLabel(aRecord({ status: "absent", completion: "not_applicable", checkInAt: null })),
    ).toBe("—");
    expect(durationLabel(aRecord({ completion: "complete", workedMinutes: 462 }))).toBe("7h 42m");
  });

  it("puts a record's times on one line", () => {
    expect(timesLine(aRecord())).toBe("08:57 WIB · Not checked out");
    expect(
      timesLine(
        aRecord({
          checkOutAt: "2026-10-30T10:39:00.000Z",
          completion: "complete",
          workedMinutes: 462,
        }),
      ),
    ).toBe("08:57–17:39 WIB · 7h 42m");
    expect(
      timesLine(aRecord({ status: "absent", completion: "not_applicable", checkInAt: null })),
    ).toBe("No check-in");
  });

  it("greets by the organization's hour", () => {
    expect(greeting("2026-10-30T01:52:14.000Z", "Asia/Jakarta")).toBe("Good morning");
    expect(greeting("2026-10-30T07:00:00.000Z", "Asia/Jakarta")).toBe("Good afternoon");
    expect(greeting("2026-10-30T13:00:00.000Z", "Asia/Jakarta")).toBe("Good evening");
  });
});
