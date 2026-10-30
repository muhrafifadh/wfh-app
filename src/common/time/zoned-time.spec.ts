import {
  addDays,
  formatTimeOfDay,
  isoWeekday,
  isValidTimeZone,
  localDateOf,
  parseTimeOfDay,
  zonedToUtc,
} from "@/common/time/zoned-time.js";

describe("zoned time", () => {
  it("knows IANA zones", () => {
    expect(isValidTimeZone("Asia/Jakarta")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("+07:00")).toBe(false);
  });

  it("takes the work date from the zone, not UTC", () => {
    // 2026-11-01 17:30 UTC is 00:30 on 2 November in Jakarta (UTC+7)
    expect(localDateOf(new Date("2026-11-01T17:30:00Z"), "Asia/Jakarta")).toBe("2026-11-02");
    expect(localDateOf(new Date("2026-11-01T16:59:59.999Z"), "Asia/Jakarta")).toBe("2026-11-01");
    expect(localDateOf(new Date("2026-11-01T17:30:00Z"), "UTC")).toBe("2026-11-01");
  });

  it("converts a local date and time to UTC", () => {
    const at = (time: string) =>
      zonedToUtc("2026-11-02", parseTimeOfDay(time) as number, "Asia/Jakarta").toISOString();
    expect(at("08:00")).toBe("2026-11-02T01:00:00.000Z");
    expect(at("09:15")).toBe("2026-11-02T02:15:00.000Z");
    expect(at("23:59:59.999")).toBe("2026-11-02T16:59:59.999Z");
    expect(at("00:00")).toBe("2026-11-01T17:00:00.000Z");
  });

  it("handles daylight saving time", () => {
    const nineAm = parseTimeOfDay("09:00") as number;
    // New York: EDT (UTC-4) on 31 October, EST (UTC-5) on 2 November 2026
    expect(zonedToUtc("2026-10-31", nineAm, "America/New_York").toISOString()).toBe(
      "2026-10-31T13:00:00.000Z",
    );
    expect(zonedToUtc("2026-11-02", nineAm, "America/New_York").toISOString()).toBe(
      "2026-11-02T14:00:00.000Z",
    );
    // 02:30 doesn't exist on 8 March 2026 (clocks jump 02:00 → 03:00)
    expect(
      zonedToUtc("2026-03-08", parseTimeOfDay("02:30") as number, "America/New_York").toISOString(),
    ).toBe("2026-03-08T07:30:00.000Z");
    // 01:30 happens twice on 1 November 2026: the first (EDT) one
    expect(
      zonedToUtc("2026-11-01", parseTimeOfDay("01:30") as number, "America/New_York").toISOString(),
    ).toBe("2026-11-01T05:30:00.000Z");
  });

  it("does date arithmetic and weekdays", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(isoWeekday("2026-11-02")).toBe(1); // Monday
    expect(isoWeekday("2026-11-08")).toBe(7); // Sunday
  });

  it("parses and formats times of day", () => {
    expect(parseTimeOfDay("09:00")).toBe(9 * 3600_000);
    expect(parseTimeOfDay("23:59:59.999")).toBe(24 * 3600_000 - 1);
    expect(parseTimeOfDay("23:59:59.9")).toBe(24 * 3600_000 - 100);
    for (const bad of ["24:00", "9:00", "09:60", "09:00:00.1234", ""]) {
      expect(parseTimeOfDay(bad)).toBeNull();
    }
    expect(formatTimeOfDay(9 * 3600_000 + 15 * 60_000)).toBe("09:15:00");
    expect(formatTimeOfDay(24 * 3600_000 - 1, "milliseconds")).toBe("23:59:59.999");
  });
});
