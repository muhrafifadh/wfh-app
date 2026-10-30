import Link from "next/link";

import { AttendanceBadges } from "@/components/shared/attendance-badges";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/shared/list-pagination";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { routes } from "@/config/routes";
import { durationLabel, formatCellTime } from "@/features/attendance/format";
import { listMyAttendance } from "@/features/attendance/queries";
import type { Attendance } from "@/features/attendance/schemas";
import { historyHref, type HistoryFilters } from "@/features/attendance/search-params";
import { formatDayDate } from "@/lib/format";
import { timeZoneLabel } from "@/lib/time-zone";

/**
 * UX_FLOWS.md §8.1–8.3 — own records in the range, newest first, 20 a page. A table on
 * wider screens; cards with the same order on phones. Each date links to its detail.
 */
export async function HistoryList({
  filters,
  from,
  to,
  timeZone,
}: {
  filters: HistoryFilters;
  from: string;
  to: string;
  /** The organization's zone, for the column headers. */
  timeZone: string;
}) {
  const result = await listMyAttendance({ from, to, status: filters.status, page: filters.page });
  const filtered = Boolean(filters.from || filters.to || filters.status);

  if (result.total === 0) {
    return filtered ? (
      <EmptyState
        title="No attendance matches these filters"
        action={
          <Button variant="outline" asChild>
            <Link href={routes.attendanceHistory()}>Reset filters</Link>
          </Button>
        }
      />
    ) : (
      <EmptyState title="No attendance records yet" />
    );
  }

  const zone = timeZoneLabel(timeZone);
  return (
    <div className="flex flex-col gap-4">
      <div className="hidden rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Date</TableHead>
              <TableHead scope="col">Status</TableHead>
              <TableHead scope="col">Check-in ({zone})</TableHead>
              <TableHead scope="col">Check-out ({zone})</TableHead>
              <TableHead scope="col">Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.items.map((record) => (
              <TableRow key={record.id}>
                <TableCell>
                  <RecordLink record={record} />
                </TableCell>
                <TableCell className="whitespace-normal">
                  <AttendanceBadges record={record} />
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatCellTime(record.checkInAt, record.schedule.timezone)}
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatCellTime(record.checkOutAt, record.schedule.timezone)}
                </TableCell>
                <TableCell>{durationLabel(record)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="flex flex-col gap-2 md:hidden">
        {result.items.map((record) => (
          <li key={record.id} className="flex flex-col gap-2 rounded-lg border p-3">
            <RecordLink record={record} />
            <AttendanceBadges record={record} />
            <dl className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Check-in</dt>
                <dd className="tabular-nums">
                  {formatCellTime(record.checkInAt, record.schedule.timezone)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Check-out</dt>
                <dd className="tabular-nums">
                  {formatCellTime(record.checkOutAt, record.schedule.timezone)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Duration</dt>
                <dd>{durationLabel(record)}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground md:hidden">Times in {zone}.</p>
      <ListPagination
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        hrefFor={(page) => historyHref({ ...filters, page })}
      />
    </div>
  );
}

function RecordLink({ record }: { record: Attendance }) {
  return (
    <Link
      href={routes.attendanceRecord(record.id)}
      className="font-medium underline-offset-4 hover:underline"
    >
      {formatDayDate(record.workDate)}
    </Link>
  );
}
