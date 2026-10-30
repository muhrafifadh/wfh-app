import { formatTimeIn, timeZoneLabel } from "@/lib/time-zone";

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

describe("formatTimeIn", () => {
  it("shows the zone's wall-clock time", () => {
    expect(formatTimeIn("2026-11-02T01:00:00.000Z", "Asia/Jakarta")).toBe("08:00:00");
    expect(formatTimeIn("2026-11-02T16:59:59.999Z", "Asia/Jakarta")).toBe("23:59:59");
  });
});
