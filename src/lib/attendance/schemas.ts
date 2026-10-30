import { z } from "zod";

// An attendance record as every endpoint returns it (backend attendance.mapper.ts), shared by
// the attendance, corrections and reports features. Checked in features/attendance/contract.ts.

export const ATTENDANCE_STATUSES = ["present", "late", "absent", "excused"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_COMPLETIONS = ["open", "complete", "not_applicable"] as const;
export const ATTENDANCE_SOURCES = ["self_service", "close_day_job"] as const;

/** The schedule as it was when the record was made (never recalculated). */
export const attendanceScheduleSchema = z.object({
  timezone: z.string(),
  checkInOpensAt: z.iso.datetime(),
  scheduledStartAt: z.iso.datetime(),
  onTimeDeadlineAt: z.iso.datetime(),
  scheduledEndAt: z.iso.datetime(),
  checkInClosesAt: z.iso.datetime(),
  checkOutClosesAt: z.iso.datetime(),
});
export type AttendanceSchedule = z.infer<typeof attendanceScheduleSchema>;

export const attendanceSchema = z.object({
  id: z.uuid(),
  workDate: z.iso.date(),
  status: z.enum(ATTENDANCE_STATUSES),
  completion: z.enum(ATTENDANCE_COMPLETIONS),
  /** Open and past the check-out deadline ("Missing check-out"). */
  incomplete: z.boolean(),
  source: z.enum(ATTENDANCE_SOURCES),
  checkInAt: z.iso.datetime().nullable(),
  checkOutAt: z.iso.datetime().nullable(),
  lateMinutes: z.int(),
  /** Set once complete. */
  workedMinutes: z.int().nullable(),
  corrected: z.boolean(),
  pendingCorrectionId: z.uuid().nullable(),
  schedule: attendanceScheduleSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Attendance = z.infer<typeof attendanceSchema>;
