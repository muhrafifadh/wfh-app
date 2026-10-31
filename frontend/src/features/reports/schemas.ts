import { z } from "zod";

import { TEAM_DAY_STATES } from "@/features/reports/constants";
import { attendanceSchema } from "@/lib/attendance/schemas";

// Backend response shapes (backend src/modules/reports/dto), checked in contract.ts

const NON_WORKING_REASONS = ["no_schedule", "non_working_day", "holiday"] as const;

export const reportEmployeeSchema = z.object({
  id: z.uuid(),
  employeeNumber: z.string(),
  fullName: z.string(),
  /** The current division. */
  division: z.object({ id: z.uuid(), code: z.string(), name: z.string() }),
});

export const reportRecordSchema = attendanceSchema.extend({ employee: reportEmployeeSchema });
export type ReportRecord = z.infer<typeof reportRecordSchema>;

export const reportSummarySchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  records: z.int(),
  present: z.int(),
  late: z.int(),
  attended: z.int(),
  absent: z.int(),
  excused: z.int(),
  complete: z.int(),
  open: z.int(),
  incomplete: z.int(),
  workedMinutes: z.int(),
  lateMinutes: z.int(),
  /** Records changed by an approved correction. */
  corrected: z.int(),
});
export type ReportSummary = z.infer<typeof reportSummarySchema>;

export const reportSchema = z.object({
  items: z.array(reportRecordSchema),
  page: z.int(),
  pageSize: z.int(),
  total: z.int(),
  summary: reportSummarySchema,
});
export type Report = z.infer<typeof reportSchema>;

export const trendPointSchema = z.object({
  date: z.iso.date(),
  isWorkingDay: z.boolean(),
  present: z.int(),
  late: z.int(),
  absent: z.int(),
  incomplete: z.int(),
});
export type TrendPoint = z.infer<typeof trendPointSchema>;

export const trendsSchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  items: z.array(trendPointSchema),
});

export const teamDaySchema = z.object({
  serverTime: z.iso.datetime(),
  workDate: z.iso.date(),
  timezone: z.string(),
  isWorkingDay: z.boolean(),
  nonWorkingReason: z.enum(NON_WORKING_REASONS).nullable(),
  summary: z.object({
    employees: z.int(),
    present: z.int(),
    late: z.int(),
    notCheckedIn: z.int(),
    notCheckedOut: z.int(),
    absent: z.int(),
  }),
  items: z.array(
    z.object({
      employee: reportEmployeeSchema,
      state: z.enum(TEAM_DAY_STATES),
      record: attendanceSchema.nullable(),
    }),
  ),
});
export type TeamDay = z.infer<typeof teamDaySchema>;
export type TeamDayItem = TeamDay["items"][number];

export const teamHistorySchema = z.object({
  items: z.array(reportRecordSchema),
  page: z.int(),
  pageSize: z.int(),
  total: z.int(),
});

export const organizationDashboardSchema = z.object({
  serverTime: z.iso.datetime(),
  workDate: z.iso.date(),
  timezone: z.string(),
  isWorkingDay: z.boolean(),
  nonWorkingReason: z.enum(NON_WORKING_REASONS).nullable(),
  /** Today's check-in window has closed: "not checked in" is final until close-day. */
  checkInWindowClosed: z.boolean(),
  activeEmployees: z.int(),
  present: z.int(),
  late: z.int(),
  absent: z.int(),
  notCheckedIn: z.int(),
  notCheckedOut: z.int(),
  pendingCorrections: z.int(),
  /** The last 30 working days, ending today. */
  trend: z.array(trendPointSchema),
});
export type OrganizationDashboard = z.infer<typeof organizationDashboardSchema>;
