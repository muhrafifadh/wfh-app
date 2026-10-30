import { WEEKDAYS } from "@/features/work-settings/constants";
import type { WorkSchedule } from "@/features/work-settings/schemas";

/** "09:00:00" → "09:00"; "23:59:59.999" → "23:59:59" (seconds only when they matter). */
export function formatLocalTime(time: string): string {
  const [hours = "00", minutes = "00", seconds = "00"] = time.split(".")[0]?.split(":") ?? [];
  return seconds === "00" ? `${hours}:${minutes}` : `${hours}:${minutes}:${seconds}`;
}

/** [1,2,3,4,5] → "Monday–Friday"; [1,3,5] → "Mon, Wed, Fri". */
export function formatWorkingDays(days: readonly number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  const names = (key: "short" | "long") =>
    sorted.map((day) => WEEKDAYS.find((w) => w.value === day)?.[key] ?? String(day));
  const consecutive = sorted.every((day, i) => i === 0 || day === (sorted[i - 1] ?? 0) + 1);
  if (sorted.length > 2 && consecutive) {
    const long = names("long");
    return `${long[0]}–${long[long.length - 1]}`;
  }
  return names("short").join(", ");
}

/** The policy values a confirmation compares, as display strings. */
export function scheduleValues(
  schedule: Pick<
    WorkSchedule,
    | "timezone"
    | "workingDays"
    | "startTime"
    | "endTime"
    | "toleranceMinutes"
    | "checkInOpensAt"
    | "checkInClosesAt"
    | "checkOutDeadline"
  >,
): [label: string, value: string][] {
  return [
    ["Time zone", schedule.timezone],
    ["Working days", formatWorkingDays(schedule.workingDays)],
    ["Hours", `${formatLocalTime(schedule.startTime)}–${formatLocalTime(schedule.endTime)}`],
    ["Late tolerance", `${schedule.toleranceMinutes} min`],
    [
      "Check-in window",
      `${formatLocalTime(schedule.checkInOpensAt)}–${formatLocalTime(schedule.checkInClosesAt)}`,
    ],
    ["Check-out closes", formatLocalTime(schedule.checkOutDeadline)],
  ];
}
