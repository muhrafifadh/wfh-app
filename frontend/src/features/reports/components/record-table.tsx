import { AttendanceBadges } from "@/components/shared/attendance-badges";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ReportRecord } from "@/features/reports/schemas";
import { durationLabel, formatCellTime } from "@/lib/attendance/format";
import { formatDayDate } from "@/lib/format";
import { timeZoneLabel } from "@/lib/time-zone";

/**
 * Records with whose they are: a table on wider screens, cards on phones, the same order.
 * Reports show the employee and division; one person's history leaves them out.
 */
export function RecordTable({
  records,
  timeZone,
  showEmployee = true,
}: {
  records: ReportRecord[];
  timeZone: string;
  showEmployee?: boolean;
}) {
  const zone = timeZoneLabel(timeZone);
  const time = (record: ReportRecord, value: string | null) =>
    formatCellTime(value, record.schedule.timezone);

  return (
    <>
      <div className="hidden rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Date</TableHead>
              {showEmployee && <TableHead scope="col">Employee</TableHead>}
              <TableHead scope="col">Status</TableHead>
              <TableHead scope="col">Check-in ({zone})</TableHead>
              <TableHead scope="col">Check-out ({zone})</TableHead>
              <TableHead scope="col">Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((record) => (
              <TableRow key={record.id}>
                <TableCell>{formatDayDate(record.workDate)}</TableCell>
                {showEmployee && (
                  <TableCell className="whitespace-normal">
                    <span className="block font-medium">{record.employee.fullName}</span>
                    <span className="text-xs text-muted-foreground">
                      {record.employee.employeeNumber} · {record.employee.division.name}
                    </span>
                  </TableCell>
                )}
                <TableCell className="whitespace-normal">
                  <AttendanceBadges record={record} />
                </TableCell>
                <TableCell className="tabular-nums">{time(record, record.checkInAt)}</TableCell>
                <TableCell className="tabular-nums">{time(record, record.checkOutAt)}</TableCell>
                <TableCell>{durationLabel(record)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="flex flex-col gap-2 md:hidden">
        {records.map((record) => (
          <li key={record.id} className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
            <p className="font-medium">
              {formatDayDate(record.workDate)}
              {showEmployee && ` · ${record.employee.fullName}`}
            </p>
            <AttendanceBadges record={record} />
            <dl className="grid grid-cols-3 gap-2">
              <div>
                <dt className="text-muted-foreground">Check-in</dt>
                <dd className="tabular-nums">{time(record, record.checkInAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Check-out</dt>
                <dd className="tabular-nums">{time(record, record.checkOutAt)}</dd>
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
    </>
  );
}
