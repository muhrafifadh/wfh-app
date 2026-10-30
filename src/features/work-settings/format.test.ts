import {
  formatLocalTime,
  formatWorkingDays,
  scheduleValues,
} from "@/features/work-settings/format";

describe("formatLocalTime", () => {
  it.each([
    ["09:00:00", "09:00"],
    ["09:15", "09:15"],
    ["23:59:59.999", "23:59:59"],
  ])("shows %s as %s", (time, shown) => {
    expect(formatLocalTime(time)).toBe(shown);
  });
});

describe("formatWorkingDays", () => {
  it.each([
    [[1, 2, 3, 4, 5], "Monday–Friday"],
    [[5, 1, 3], "Mon, Wed, Fri"],
    [[6, 7], "Sat, Sun"],
  ])("names %j %s", (days, name) => {
    expect(formatWorkingDays(days)).toBe(name);
  });
});

it("lists the baseline schedule's values", () => {
  expect(
    scheduleValues({
      timezone: "Asia/Jakarta",
      workingDays: [1, 2, 3, 4, 5],
      startTime: "09:00:00",
      endTime: "17:00:00",
      toleranceMinutes: 15,
      checkInOpensAt: "08:00:00",
      checkInClosesAt: "17:00:00",
      checkOutDeadline: "23:59:59.999",
    }),
  ).toEqual([
    ["Time zone", "Asia/Jakarta"],
    ["Working days", "Monday–Friday"],
    ["Hours", "09:00–17:00"],
    ["Late tolerance", "15 min"],
    ["Check-in window", "08:00–17:00"],
    ["Check-out closes", "23:59:59"],
  ]);
});
