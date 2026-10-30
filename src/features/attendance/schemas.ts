import { z } from "zod";

import {
  ATTENDANCE_COMPLETIONS,
  ATTENDANCE_SOURCES,
  ATTENDANCE_STATUSES,
  NON_WORKING_REASONS,
  TODAY_STATES,
} from "@/features/attendance/constants";

// Backend response shapes (backend src/modules/attendance/dto), checked in contract.ts

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

export const attendanceListSchema = z.object({
  items: z.array(attendanceSchema),
  page: z.int(),
  pageSize: z.int(),
  total: z.int(),
});
export type AttendanceList = z.infer<typeof attendanceListSchema>;

/** GET /attendance/today: what the attendance card shows now. */
export const todaySchema = z.object({
  /** Seed for the on-screen clock; decisions are always the server's. */
  serverTime: z.iso.datetime(),
  workDate: z.iso.date(),
  timezone: z.string(),
  state: z.enum(TODAY_STATES),
  canCheckIn: z.boolean(),
  canCheckOut: z.boolean(),
  nonWorkingReason: z.enum(NON_WORKING_REASONS).nullable(),
  holiday: z.object({ name: z.string() }).nullable(),
  schedule: attendanceScheduleSchema.nullable(),
  record: attendanceSchema.nullable(),
  employee: z.object({ id: z.uuid(), employeeNumber: z.string(), fullName: z.string() }).nullable(),
  supportContact: z.string().nullable(),
});
export type Today = z.infer<typeof todaySchema>;

export const attendanceSummarySchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  records: z.int(),
  present: z.int(),
  late: z.int(),
  attended: z.int(),
  absent: z.int(),
  excused: z.int(),
  complete: z.int(),
  /** Open and still within the check-out deadline. */
  open: z.int(),
  /** Open past the check-out deadline. */
  incomplete: z.int(),
  workedMinutes: z.int(),
  lateMinutes: z.int(),
});
export type AttendanceSummary = z.infer<typeof attendanceSummarySchema>;

// What we send

/** One check-in or check-out intent; every retry of that intent reuses it. */
export const idempotencyKeySchema = z.uuid();

export const attendanceIdSchema = z.uuid();
