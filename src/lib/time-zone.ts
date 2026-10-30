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

/** An instant as a date and minute in a zone: "Tue, 27 Oct 2026, 08:59 WIB". */
export function formatDateTimeIn(isoDateTime: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(isoDateTime));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${part("weekday")}, ${part("day")} ${part("month")} ${part("year")}, ${part("hour")}:${part("minute")} ${timeZoneLabel(timeZone)}`;
}
