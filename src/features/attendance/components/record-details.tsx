import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AttendanceBadges } from "@/features/attendance/components/attendance-badges";
import { durationLabel, EMPTY, formatClock, lateMessage } from "@/features/attendance/format";
import type { Attendance } from "@/features/attendance/schemas";
import { formatDateTime } from "@/lib/format";

/** An instant in the record's zone, with UTC on hover for audit (UX_FLOWS.md §3.4). */
function Instant({ value, timeZone }: { value: string | null; timeZone: string }) {
  if (!value) return <>{EMPTY}</>;
  return (
    <time dateTime={value} title={formatDateTime(value)} className="tabular-nums">
      {formatClock(value, timeZone)}
    </time>
  );
}

function Rows({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

const COMPLETION = (record: Attendance) => {
  if (record.completion === "complete") return "Complete";
  if (record.completion === "open")
    return record.incomplete ? "Missing check-out" : "Not checked out yet";
  return "Not applicable";
};

/** UX_FLOWS.md §8.4 — what was recorded, and the schedule it was judged by. */
export function RecordDetails({ record }: { record: Attendance }) {
  const zone = record.schedule.timezone;
  const attended = record.status === "present" || record.status === "late";
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Attendance</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <AttendanceBadges record={record} />
        <Rows
          rows={[
            ["Check-in", <Instant key="in" value={record.checkInAt} timeZone={zone} />],
            ["Check-out", <Instant key="out" value={record.checkOutAt} timeZone={zone} />],
            ["Duration", durationLabel(record)],
            [
              "Lateness",
              !attended ? EMPTY : record.status === "late" ? lateMessage(record) : "On time",
            ],
            ["Completion", COMPLETION(record)],
            [
              "Recorded by",
              record.source === "self_service"
                ? "You (self check-in)"
                : "The system, after the day closed with no check-in",
            ],
          ]}
        />
        <p className="text-xs text-muted-foreground">
          Duration is the time between check-in and check-out. It isn&apos;t a productivity measure.
        </p>
      </CardContent>
    </Card>
  );
}

/** The schedule snapshot taken when the record was made; it never changes afterwards. */
export function ScheduleSnapshot({ schedule }: { schedule: Attendance["schedule"] }) {
  const zone = schedule.timezone;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Schedule for this day</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Rows
          rows={[
            ["Check-in opens", <Instant key="a" value={schedule.checkInOpensAt} timeZone={zone} />],
            ["Start", <Instant key="b" value={schedule.scheduledStartAt} timeZone={zone} />],
            [
              "On time until",
              <Instant key="c" value={schedule.onTimeDeadlineAt} timeZone={zone} />,
            ],
            ["End", <Instant key="d" value={schedule.scheduledEndAt} timeZone={zone} />],
            [
              "Check-in closes",
              <Instant key="e" value={schedule.checkInClosesAt} timeZone={zone} />,
            ],
            [
              "Check-out deadline",
              <Instant key="f" value={schedule.checkOutClosesAt} timeZone={zone} />,
            ],
          ]}
        />
      </CardContent>
    </Card>
  );
}
