import { timeZoneLabel } from "@/lib/time-zone";

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
