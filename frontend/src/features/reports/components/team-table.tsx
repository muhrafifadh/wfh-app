import Link from "next/link";

import { AttendanceBadges } from "@/components/shared/attendance-badges";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { routes } from "@/config/routes";
import { TEAM_DAY_STATE_LABEL } from "@/features/reports/constants";
import type { TeamDayItem } from "@/features/reports/schemas";
import { EMPTY, formatCellTime } from "@/lib/attendance/format";
import { timeZoneLabel } from "@/lib/time-zone";

const scheduleOf = (item: TeamDayItem) =>
  item.record
    ? `${formatCellTime(item.record.schedule.scheduledStartAt, item.record.schedule.timezone)}–${formatCellTime(item.record.schedule.scheduledEndAt, item.record.schedule.timezone)}`
    : EMPTY;

function Status({ item }: { item: TeamDayItem }) {
  return item.record ? (
    <AttendanceBadges record={item.record} />
  ) : (
    <Badge variant="outline">{TEAM_DAY_STATE_LABEL[item.state]}</Badge>
  );
}

/**
 * UX_FLOWS.md §10 — direct reports on a day: schedule, times, status, completion and the
 * correction indicator. Each name opens that person's last 90 days.
 */
export function TeamTable({ items, timeZone }: { items: TeamDayItem[]; timeZone: string }) {
  const zone = timeZoneLabel(timeZone);
  const time = (item: TeamDayItem, key: "checkInAt" | "checkOutAt") =>
    item.record ? formatCellTime(item.record[key], item.record.schedule.timezone) : EMPTY;

  return (
    <>
      <div className="hidden rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Name</TableHead>
              <TableHead scope="col">Schedule ({zone})</TableHead>
              <TableHead scope="col">Check-in</TableHead>
              <TableHead scope="col">Check-out</TableHead>
              <TableHead scope="col">Status</TableHead>
              <TableHead scope="col">Day</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.employee.id}>
                <TableCell className="whitespace-normal">
                  <Link
                    href={routes.teamMember(item.employee.id)}
                    className="block font-medium underline-offset-4 hover:underline"
                  >
                    {item.employee.fullName}
                  </Link>
                  <span className="font-mono text-xs text-muted-foreground">
                    {item.employee.employeeNumber}
                  </span>
                </TableCell>
                <TableCell className="tabular-nums">{scheduleOf(item)}</TableCell>
                <TableCell className="tabular-nums">{time(item, "checkInAt")}</TableCell>
                <TableCell className="tabular-nums">{time(item, "checkOutAt")}</TableCell>
                <TableCell className="whitespace-normal">
                  <Status item={item} />
                </TableCell>
                <TableCell>{TEAM_DAY_STATE_LABEL[item.state]}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="flex flex-col gap-2 md:hidden">
        {items.map((item) => (
          <li key={item.employee.id} className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
            <div>
              <Link
                href={routes.teamMember(item.employee.id)}
                className="font-medium underline-offset-4 hover:underline"
              >
                {item.employee.fullName}
              </Link>{" "}
              <span className="font-mono text-xs text-muted-foreground">
                {item.employee.employeeNumber}
              </span>
            </div>
            <Status item={item} />
            <dl className="grid grid-cols-3 gap-2">
              <div>
                <dt className="text-muted-foreground">Check-in</dt>
                <dd className="tabular-nums">{time(item, "checkInAt")}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Check-out</dt>
                <dd className="tabular-nums">{time(item, "checkOutAt")}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Day</dt>
                <dd>{TEAM_DAY_STATE_LABEL[item.state]}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground md:hidden">Times in {zone}.</p>
    </>
  );
}
