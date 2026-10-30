import Link from "next/link";

import { STATUS_BADGES } from "@/components/shared/status-badge";
import { routes } from "@/config/routes";
import { firstDayOf, lastDayOf, monthWeeks } from "@/features/attendance/dates";
import { formatLongDate, formatMonthYear } from "@/features/attendance/format";
import { listMyAttendance } from "@/features/attendance/queries";
import type { Attendance } from "@/features/attendance/schemas";
import { cn } from "@/lib/utils";

const WEEKDAYS = [
  ["Mon", "Monday"],
  ["Tue", "Tuesday"],
  ["Wed", "Wednesday"],
  ["Thu", "Thursday"],
  ["Fri", "Friday"],
  ["Sat", "Saturday"],
  ["Sun", "Sunday"],
] as const;

const TONE_TEXT = {
  success: "text-success",
  warning: "text-warning",
  info: "text-info",
  danger: "text-destructive",
  strong: "text-foreground",
  neutral: "text-muted-foreground",
} as const;

/** What a day shows: the status, or "Incomplete" when the check-out is missing. */
const markOf = (record: Attendance) =>
  STATUS_BADGES[record.incomplete ? "incomplete" : record.status];

/**
 * UX_FLOWS.md §8.1 — the monthly view: one cell per day with its status (word and icon,
 * never color alone), linking to the record. Days without a record stay plain.
 */
export async function HistoryCalendar({ month, today }: { month: string; today: string }) {
  const list = await listMyAttendance({
    from: firstDayOf(month),
    to: lastDayOf(month),
    pageSize: 31,
  });
  const byDate = new Map(list.items.map((record) => [record.workDate, record]));

  return (
    <table className="w-full table-fixed border-collapse text-sm">
      <caption className="sr-only">Attendance in {formatMonthYear(month)}</caption>
      <thead>
        <tr>
          {WEEKDAYS.map(([short, long]) => (
            <th key={short} scope="col" className="pb-2 text-xs font-medium text-muted-foreground">
              <abbr title={long} className="no-underline">
                {short}
              </abbr>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {monthWeeks(month).map((week, index) => (
          <tr key={index}>
            {week.map((day, column) =>
              day ? (
                <td key={day} className="border p-0 align-top">
                  <DayCell day={day} record={byDate.get(day)} isToday={day === today} />
                </td>
              ) : (
                <td key={`blank-${column}`} className="border bg-muted/40" />
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DayCell({
  day,
  record,
  isToday,
}: {
  day: string;
  record: Attendance | undefined;
  isToday: boolean;
}) {
  const number = (
    <span
      className={cn(
        "self-start text-xs tabular-nums",
        isToday && "rounded-sm bg-primary px-1 font-semibold text-primary-foreground",
      )}
    >
      {Number(day.slice(8))}
    </span>
  );
  if (!record) {
    return (
      <div className="flex h-16 flex-col p-1 sm:h-20 sm:p-2">
        {number}
        <span className="sr-only">{formatLongDate(day)}: no record</span>
      </div>
    );
  }
  const { label, icon: Icon, tone } = markOf(record);
  return (
    <Link
      href={routes.attendanceRecord(record.id)}
      className="flex h-16 flex-col gap-1 p-1 hover:bg-accent focus-visible:bg-accent sm:h-20 sm:p-2"
      aria-label={`${formatLongDate(day)}: ${label}`}
    >
      {number}
      <span className={cn("flex items-center gap-1 text-xs font-medium", TONE_TEXT[tone])}>
        <Icon aria-hidden className="size-3.5 shrink-0" />
        <span className="hidden truncate sm:inline">{label}</span>
      </span>
    </Link>
  );
}
