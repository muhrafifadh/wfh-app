import type { AttendanceStatus } from "@/features/attendance/constants";
import {
  formatClock,
  formatDuration,
  formatMinute,
  lateMessage,
} from "@/features/attendance/format";
import type { Today } from "@/features/attendance/schemas";

/** The card's one primary action (UX_FLOWS.md §2.1), or a link onward. */
export type TodayAction =
  | { kind: "check_in" }
  | { kind: "check_out" }
  | { kind: "request_correction"; attendanceId: string }
  | { kind: "history" }
  | { kind: "contact_support" }
  | { kind: "none" };

export type TodayView = {
  /** The status heading ("Not checked in"); focus moves here after an action. */
  title: string;
  /** Present or Late once there's a record. */
  status: AttendanceStatus | null;
  /** What it means and what happens next, in plain words. */
  lines: string[];
  action: TodayAction;
};

const NON_WORKING: Record<NonNullable<Today["nonWorkingReason"]>, string> = {
  non_working_day: "It's not one of your scheduled working days.",
  holiday: "It's a holiday.",
  no_schedule: "No work schedule is in force today.",
};

/**
 * UX_FLOWS.md §7.2 — what the card shows for each server-decided state. The browser
 * never works out eligibility itself; `canCheckIn`/`canCheckOut` gate the buttons.
 */
export function describeToday(today: Today): TodayView {
  const { record, schedule } = today;
  const zone = schedule?.timezone ?? today.timezone;
  const checkedInLine = record?.checkInAt
    ? `Checked in at ${formatClock(record.checkInAt, zone)}.`
    : null;
  const lateLine = record && record.status === "late" ? lateMessage(record) : null;

  switch (today.state) {
    case "no_profile":
      return {
        title: "No employee profile",
        status: null,
        lines: [
          "Your account doesn't have an active employee profile, so there's no attendance to record.",
        ],
        action: { kind: "contact_support" },
      };
    case "inactive":
      return {
        title: "Employee profile inactive",
        status: null,
        lines: ["Your employee profile is inactive, so you can't check in today."],
        action: { kind: "contact_support" },
      };
    case "non_working_day":
      return {
        title: "Today is not a working day",
        status: null,
        lines: [
          today.holiday
            ? `It's a holiday: ${today.holiday.name}.`
            : NON_WORKING[today.nonWorkingReason ?? "non_working_day"],
        ],
        action: { kind: "none" },
      };
    case "before_window":
      return {
        title: "Check-in not open yet",
        status: null,
        lines: schedule
          ? [`Check-in opens at ${formatMinute(schedule.checkInOpensAt, zone)}.`]
          : [],
        action: { kind: "check_in" },
      };
    case "ready_to_check_in":
      return {
        title: "Not checked in",
        status: null,
        lines: schedule
          ? [
              `Check in by ${formatMinute(schedule.onTimeDeadlineAt, zone)} to be on time.`,
              `Check-in closes at ${formatMinute(schedule.checkInClosesAt, zone)}.`,
            ]
          : [],
        action: { kind: "check_in" },
      };
    case "window_closed":
      return {
        title: "Today's check-in window has closed",
        status: null,
        lines: [
          "You can request a correction after the day closes: from tomorrow, within seven days.",
        ],
        action: { kind: "none" },
      };
    case "checked_in":
      return {
        title: "Checked in",
        status: record?.status ?? null,
        lines: [
          ...(checkedInLine ? [checkedInLine] : []),
          ...(lateLine ? [lateLine] : []),
          ...(schedule ? [`Check out by ${formatMinute(schedule.checkOutClosesAt, zone)}.`] : []),
        ],
        action: { kind: "check_out" },
      };
    case "check_out_closed":
      return {
        title: "Missing check-out",
        status: record?.status ?? null,
        lines: [
          ...(checkedInLine ? [checkedInLine] : []),
          "The check-out deadline has passed. Request a correction to add your check-out.",
        ],
        action: record ? { kind: "request_correction", attendanceId: record.id } : { kind: "none" },
      };
    case "checked_out":
      return {
        title: "Done for today",
        status: record?.status ?? null,
        lines: [
          ...(checkedInLine ? [checkedInLine] : []),
          ...(lateLine ? [lateLine] : []),
          ...(record?.checkOutAt
            ? [`Checked out at ${formatClock(record.checkOutAt, zone)}.`]
            : []),
          ...(record?.workedMinutes != null
            ? [`Worked ${formatDuration(record.workedMinutes)}.`]
            : []),
        ],
        action: { kind: "history" },
      };
  }
}

/**
 * When the server's answer changes on its own (check-in opens or closes, the check-out
 * deadline passes), so the card can re-check right then. The backend still decides.
 */
export function nextBoundary(today: Today): string | null {
  const boundaries = today.schedule;
  if (!boundaries) return null;
  switch (today.state) {
    case "before_window":
      return boundaries.checkInOpensAt;
    case "ready_to_check_in":
      return boundaries.checkInClosesAt;
    case "checked_in":
      return boundaries.checkOutClosesAt;
    default:
      return null;
  }
}
