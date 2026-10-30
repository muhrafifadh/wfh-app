import { addDays, formatTimeIn, timeZoneLabel, todayIn } from "@/lib/time-zone";

describe("timeZoneLabel", () => {
  it.each([
    ["Asia/Jakarta", "WIB"],
    ["Asia/Makassar", "WITA"],
    ["Asia/Jayapura", "WIT"],
    ["Asia/Tokyo", "GMT+9"],
    ["UTC", "UTC"],
  ])("labels %s as %s", (zone, label) => {
    expect(timeZoneLabel(zone)).toBe(label);
  });
});

describe("todayIn", () => {
  it("uses the zone's date, not UTC's", () => {
    // 2026-11-01 18:30 UTC is already 2 November in Jakarta (UTC+7)
    const now = new Date("2026-11-01T18:30:00Z");
    expect(todayIn("Asia/Jakarta", now)).toBe("2026-11-02");
    expect(todayIn("UTC", now)).toBe("2026-11-01");
  });
});

describe("addDays", () => {
  it.each([
    ["2026-11-02", 1, "2026-11-03"],
    ["2026-12-31", 1, "2027-01-01"],
    ["2026-03-01", -1, "2026-02-28"],
  ])("%s + %i is %s", (date, days, expected) => {
    expect(addDays(date, days)).toBe(expected);
  });
});

describe("formatTimeIn", () => {
  it("shows the zone's wall-clock time", () => {
    expect(formatTimeIn("2026-11-02T01:00:00.000Z", "Asia/Jakarta")).toBe("08:00:00");
    expect(formatTimeIn("2026-11-02T16:59:59.999Z", "Asia/Jakarta")).toBe("23:59:59");
  });
});
