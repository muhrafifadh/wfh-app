import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SCHEDULE_STATE_LABEL } from "@/features/work-settings/constants";
import { formatLocalTime, formatWorkingDays } from "@/features/work-settings/format";
import type { WorkSchedule } from "@/features/work-settings/schemas";
import { formatDayDate } from "@/lib/format";

/** Every version, newest first: changes never overwrite an earlier one. */
export function ScheduleHistory({ schedules }: { schedules: WorkSchedule[] }) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Version</TableHead>
            <TableHead scope="col">In force</TableHead>
            <TableHead scope="col" className="hidden md:table-cell">
              Days
            </TableHead>
            <TableHead scope="col" className="hidden md:table-cell">
              Hours
            </TableHead>
            <TableHead scope="col" className="hidden lg:table-cell">
              Created by
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {schedules.map((schedule) => (
            <TableRow key={schedule.id}>
              <TableCell className="whitespace-normal">
                {schedule.name}{" "}
                <Badge variant={schedule.state === "current" ? "default" : "outline"}>
                  {SCHEDULE_STATE_LABEL[schedule.state]}
                </Badge>
              </TableCell>
              <TableCell className="whitespace-normal">
                {formatDayDate(schedule.effectiveFrom)} –{" "}
                {schedule.effectiveTo ? formatDayDate(schedule.effectiveTo) : "onwards"}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {formatWorkingDays(schedule.workingDays)}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {formatLocalTime(schedule.startTime)}–{formatLocalTime(schedule.endTime)}
              </TableCell>
              <TableCell className="hidden lg:table-cell">{schedule.createdBy.name}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
