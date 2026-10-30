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
