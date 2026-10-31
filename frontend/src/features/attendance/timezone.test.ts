import { aRecord, aToday } from "@/features/attendance/fixtures";
import { formatClock, formatLongDate, timesLine } from "@/features/attendance/format";
import { describeToday } from "@/features/attendance/today-view";
import { addDays, isoWeekday } from "@/lib/dates";

// DOMAIN_RULES.md §17 Scenario D — the employee's device is in Tokyo, the organization
// in Jakarta. What the card shows follows Jakarta, never the device. Node applies a TZ
// change at runtime, so this runs the formatters as a Tokyo device would.
describe("on a device in another time zone (Scenario D)", () => {
  beforeAll(() => {
    vi.stubEnv("TZ", "Asia/Tokyo");
  });
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it("really is running in Tokyo", () => {
    expect(new Date("2026-10-30T01:52:14.000Z").getHours()).toBe(10);
  });

  it("shows times, the work date and the state in Jakarta", () => {
    expect(formatClock("2026-10-30T01:52:14.000Z", "Asia/Jakarta")).toBe("08:52:14 WIB");
    expect(formatLongDate("2026-10-30")).toBe("Friday, 30 October 2026");
    expect(timesLine(aRecord())).toBe("08:57 WIB · Not checked out");
    expect(describeToday(aToday()).lines).toEqual([
      "Check in by 09:15 WIB to be on time.",
      "Check-in closes at 12:00 WIB.",
    ]);
  });

  it("does calendar arithmetic without the device's zone", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(isoWeekday("2026-11-02")).toBe(1);
  });
});
