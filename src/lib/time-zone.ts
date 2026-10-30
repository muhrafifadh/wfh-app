// Indonesia's zones go by their local names (UX_FLOWS.md §3.4: "09:15:00 WIB").
const LOCAL_NAMES: Record<string, string> = {
  "Asia/Jakarta": "WIB",
  "Asia/Pontianak": "WIB",
  "Asia/Makassar": "WITA",
  "Asia/Jayapura": "WIT",
};

/** "Asia/Jakarta" → "WIB"; other zones get Intl's short name ("GMT+9", "CET"). */
export function timeZoneLabel(timeZone: string): string {
  const local = LOCAL_NAMES[timeZone];
  if (local) return local;
  // A fixed reference date keeps the label stable between server and client renders
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" }).formatToParts(
    new Date("2026-01-15T00:00:00Z"),
  );
  return parts.find((part) => part.type === "timeZoneName")?.value ?? timeZone;
}

/** Today's date (YYYY-MM-DD) in a zone: the organization's work date, not the browser's. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  // en-CA formats dates as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
}

/** YYYY-MM-DD plus `days` (calendar arithmetic, no time zone involved). */
export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** An instant as the wall-clock time in a zone: "2026-11-02T01:00:00Z" in Jakarta → "08:00:00". */
export function formatTimeIn(isoDateTime: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date(isoDateTime));
}
