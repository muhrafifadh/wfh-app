import type { Correction } from "@/features/corrections/schemas";
import { formatTimeIn, timeZoneLabel } from "@/lib/time-zone";

const minute = (value: string | null, timeZone: string) =>
  value ? formatTimeIn(value, timeZone).slice(0, 5) : "none";

/** "Check-in 09:42 → 08:58 · Check-out none → 17:10 (WIB)": only what changes. */
export function changeSummary(
  correction: Pick<Correction, "changes" | "current" | "requested" | "timezone">,
) {
  const { current, requested, timezone } = correction;
  const parts = correction.changes.map((change) =>
    change === "check_in"
      ? `Check-in ${minute(current.checkInAt, timezone)} → ${minute(requested.checkInAt, timezone)}`
      : `Check-out ${minute(current.checkOutAt, timezone)} → ${minute(requested.checkOutAt, timezone)}`,
  );
  return `${parts.join(" · ")} (${timeZoneLabel(timezone)})`;
}
