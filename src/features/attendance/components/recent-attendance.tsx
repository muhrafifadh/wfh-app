import Link from "next/link";

import { ChevronRightIcon } from "lucide-react";

import { AttendanceBadges } from "@/components/shared/attendance-badges";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { canRequestCorrection } from "@/features/attendance/dates";
import { timesLine } from "@/features/attendance/format";
import { listRecentAttendance } from "@/features/attendance/queries";
import { formatDayDate } from "@/lib/format";

/**
 * The latest records, newest first. A missing check-out still in the correction window
 * gets "Request correction" (UX_FLOWS.md §7.2 I).
 */
export async function RecentAttendance({ count, today }: { count: number; today: string }) {
  const records = await listRecentAttendance(count);
  if (records.length === 0) {
    return <EmptyState title="No attendance records yet" />;
  }

  return (
    <ul className="divide-y rounded-lg border">
      {records.map((record) => {
        return (
          <li key={record.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Link
                href={routes.attendanceRecord(record.id)}
                className="font-medium underline-offset-4 hover:underline"
              >
                {formatDayDate(record.workDate)}
              </Link>
              <span className="text-sm text-muted-foreground tabular-nums">
                {timesLine(record)}
              </span>
            </div>
            <AttendanceBadges record={record} />
            {record.incomplete && canRequestCorrection(record, today) ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={routes.newCorrection(record.id)}>Request correction</Link>
              </Button>
            ) : (
              <ChevronRightIcon
                aria-hidden
                className="hidden size-4 text-muted-foreground sm:block"
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
