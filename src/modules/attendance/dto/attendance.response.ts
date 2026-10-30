import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { paginated } from "@/common/dto/pagination.js";
import {
  ATTENDANCE_COMPLETIONS,
  ATTENDANCE_SOURCES,
  ATTENDANCE_STATUSES,
  TODAY_STATES,
} from "@/modules/attendance/attendance.constants.js";
import { NON_WORKING_REASONS } from "@/modules/holidays/holidays.constants.js";

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

export const attendanceResponseSchema = z.object({
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
  schedule: attendanceScheduleSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type AttendanceResponseBody = z.infer<typeof attendanceResponseSchema>;

export const todayResponseSchema = z.object({
  /** Seed for the on-screen clock; decisions are always the server's. */
  serverTime: z.iso.datetime(),
  workDate: z.iso.date(),
  timezone: z.string(),
  state: z.enum(TODAY_STATES),
  canCheckIn: z.boolean(),
  canCheckOut: z.boolean(),
  /** Why today isn't a working day; null on a working day. */
  nonWorkingReason: z.enum(NON_WORKING_REASONS).nullable(),
  holiday: z.object({ name: z.string() }).nullable(),
  /** Today's boundaries: the record's snapshot once checked in, else the schedule in force. */
  schedule: attendanceScheduleSchema.nullable(),
  record: attendanceResponseSchema.nullable(),
  employee: z.object({ id: z.uuid(), employeeNumber: z.string(), fullName: z.string() }).nullable(),
  /** Shown when there's no active profile ("Contact Admin/HR"). */
  supportContact: z.string().nullable(),
});

export type TodayResponseBody = z.infer<typeof todayResponseSchema>;

export const attendanceSummarySchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  /** Records in the range (one per work date with attendance). */
  records: z.int(),
  present: z.int(),
  late: z.int(),
  /** present + late */
  attended: z.int(),
  absent: z.int(),
  excused: z.int(),
  complete: z.int(),
  /** Open and still within the check-out deadline. */
  open: z.int(),
  /** Open past the check-out deadline. */
  incomplete: z.int(),
  /** Sum over complete records. */
  workedMinutes: z.int(),
  lateMinutes: z.int(),
});

export type AttendanceSummaryBody = z.infer<typeof attendanceSummarySchema>;

export class AttendanceResponse extends createZodDto(attendanceResponseSchema) {}
export class AttendanceListResponse extends createZodDto(paginated(attendanceResponseSchema)) {}
export class TodayResponse extends createZodDto(todayResponseSchema) {}
export class AttendanceSummaryResponse extends createZodDto(attendanceSummarySchema) {}
