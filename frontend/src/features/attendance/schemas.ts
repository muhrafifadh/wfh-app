import { z } from "zod";

import { NON_WORKING_REASONS, TODAY_STATES } from "@/features/attendance/constants";
import { attendanceScheduleSchema, attendanceSchema } from "@/lib/attendance/schemas";

// Backend response shapes (backend src/modules/attendance/dto), checked in contract.ts

export {
  attendanceScheduleSchema,
  attendanceSchema,
  type Attendance,
  type AttendanceSchedule,
} from "@/lib/attendance/schemas";

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
