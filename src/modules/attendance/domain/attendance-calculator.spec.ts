import {
  canCheckOutAt,
  checkInWindowAt,
  isIncomplete,
  statusAtCheckIn,
  workedMinutesBetween,
} from "@/modules/attendance/domain/attendance-calculator.js";

// Baseline on Monday 2 November 2026 in Jakarta (UTC+7)
const wib = (time: string) => new Date(`2026-11-02T${time}+07:00`);
const boundaries = {
  checkInOpensAt: wib("08:00:00.000"),
  checkInClosesAt: wib("17:00:00.000"),
};
const onTimeDeadline = wib("09:15:00.000");

describe("attendance calculator", () => {
  it.each([
    ["08:00:00", "present", 0],
    ["09:15:00", "present", 0],
    ["09:15:01", "late", 1],
    ["09:16:00", "late", 1],
    ["09:16:01", "late", 2],
    ["09:15:00.001", "late", 1],
  ] as const)("check-in at %s is %s, %i minutes late (§7.3)", (time, status, lateMinutes) => {
    expect(statusAtCheckIn(wib(time), onTimeDeadline)).toEqual({ status, lateMinutes });
  });

  it.each([
    ["07:59:59", "too_early"],
    ["07:59:59.999", "too_early"],
    ["08:00:00", "open"],
    ["17:00:00", "open"],
    ["17:00:00.001", "closed"],
    ["17:00:01", "closed"],
  ] as const)("the window at %s is %s (§7.2, inclusive)", (time, window) => {
    expect(checkInWindowAt(wib(time), boundaries)).toBe(window);
  });

  it("allows check-out up to and including 23:59:59.999", () => {
    const deadline = wib("23:59:59.999");
    expect(canCheckOutAt(wib("23:59:59.999"), deadline)).toBe(true);
    expect(canCheckOutAt(new Date("2026-11-02T17:00:00.000Z"), deadline)).toBe(false); // 00:00 on the 3rd
  });

  it("rounds worked time down to whole minutes", () => {
    expect(workedMinutesBetween(wib("08:57:00"), wib("17:03:59.999"))).toBe(486);
    expect(workedMinutesBetween(wib("09:00:00"), wib("09:00:00"))).toBe(0);
  });

  it("calls an open record incomplete only after its check-out deadline", () => {
    const record = { completion: "open", checkOutClosesAt: wib("23:59:59.999") };
    expect(isIncomplete(record, wib("23:59:59.999"))).toBe(false);
    expect(isIncomplete(record, new Date("2026-11-02T17:00:00.000Z"))).toBe(true);
    expect(
      isIncomplete({ ...record, completion: "complete" }, new Date("2026-11-03T00:00:00Z")),
    ).toBe(false);
  });
});
