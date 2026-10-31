import Link from "next/link";

import type { HistoryStatus } from "@/features/attendance/constants";
import { formatDuration } from "@/features/attendance/format";
import { getAttendanceSummary } from "@/features/attendance/queries";
import { historyHref } from "@/features/attendance/search-params";
import { cn } from "@/lib/utils";

const COUNTS: { key: HistoryStatus; label: string }[] = [
  { key: "present", label: "Present" },
  { key: "late", label: "Late" },
  { key: "absent", label: "Absent" },
  { key: "incomplete", label: "Incomplete" },
];

/**
 * Present, late, absent, incomplete and worked time for a range. Each count links to
 * the history list behind it (UX_FLOWS.md §6.4).
 */
export async function AttendanceSummary({
  from,
  to,
  compact = false,
}: {
  from: string;
  to: string;
  /** Two columns, for a dashboard card. */
  compact?: boolean;
}) {
  const summary = await getAttendanceSummary(from, to);
  return (
    <dl className={cn("grid grid-cols-2 gap-3", !compact && "sm:grid-cols-5")}>
      {COUNTS.map(({ key, label }) => (
        <div key={key} className="rounded-lg border p-3">
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="text-2xl font-semibold tabular-nums">
            <Link
              href={historyHref({ from, to, status: key })}
              className="underline-offset-4 hover:underline"
              aria-label={`${summary[key]} ${label.toLowerCase()}: view these days`}
            >
              {summary[key]}
            </Link>
          </dd>
        </div>
      ))}
      <div className={cn("col-span-2 rounded-lg border p-3", !compact && "sm:col-span-1")}>
        <dt className="text-sm text-muted-foreground">Worked</dt>
        <dd className="text-2xl font-semibold tabular-nums">
          {formatDuration(summary.workedMinutes)}
        </dd>
      </div>
    </dl>
  );
}
