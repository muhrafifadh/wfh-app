import { Badge } from "@/components/ui/badge";
import { SCHEDULE_STATE_LABEL } from "@/features/work-settings/constants";
import { formatLocalTime, scheduleValues } from "@/features/work-settings/format";
import type { WorkSchedule } from "@/features/work-settings/schemas";
import { formatDayDate } from "@/lib/format";
import { timeZoneLabel } from "@/lib/time-zone";

/** One schedule version's policy, in the organization's terms. */
export function ScheduleSummary({ schedule }: { schedule: WorkSchedule }) {
  const zone = timeZoneLabel(schedule.timezone);
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium">{schedule.name}</h3>
        <Badge variant={schedule.state === "current" ? "default" : "outline"}>
          {SCHEDULE_STATE_LABEL[schedule.state]}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        From {formatDayDate(schedule.effectiveFrom)}
        {schedule.effectiveTo ? ` to ${formatDayDate(schedule.effectiveTo)}` : " onwards"}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        {scheduleValues(schedule).map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd>
              {value}
              {label !== "Time zone" && label !== "Working days" && label !== "Late tolerance"
                ? ` ${zone}`
                : ""}
            </dd>
          </div>
        ))}
        <dt className="text-muted-foreground">On time until</dt>
        <dd>
          {formatLocalTime(schedule.onTimeDeadline)} {zone}
        </dd>
      </dl>
    </div>
  );
}
