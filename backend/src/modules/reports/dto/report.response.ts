import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { paginated } from "@/common/dto/pagination.js";
import {
  attendanceResponseSchema,
  attendanceSummarySchema,
} from "@/modules/attendance/dto/attendance.response.js";
import { NON_WORKING_REASONS } from "@/modules/holidays/holidays.constants.js";
import { TEAM_DAY_STATES } from "@/modules/reports/reports.constants.js";

export const reportEmployeeSchema = z.object({
  id: z.uuid(),
  employeeNumber: z.string(),
  fullName: z.string(),
  /** The current division. */
  division: z.object({ id: z.uuid(), code: z.string(), name: z.string() }),
});

/** A record with whose it is. */
export const reportRecordSchema = attendanceResponseSchema.extend({
  employee: reportEmployeeSchema,
});

export type ReportRecordBody = z.infer<typeof reportRecordSchema>;

/** Reconciles with the records for the same filter (DOMAIN_RULES.md §13). */
export const reportSummarySchema = attendanceSummarySchema.extend({
  /** Records changed by an approved correction. */
  corrected: z.int(),
});

export type ReportSummaryBody = z.infer<typeof reportSummarySchema>;

export const reportResponseSchema = paginated(reportRecordSchema).extend({
  summary: reportSummarySchema,
});

export type ReportResponseBody = z.infer<typeof reportResponseSchema>;

export const trendPointSchema = z.object({
  date: z.iso.date(),
  isWorkingDay: z.boolean(),
  present: z.int(),
  late: z.int(),
  absent: z.int(),
  /** Open past the check-out deadline (as of now). */
  incomplete: z.int(),
});

export type TrendPointBody = z.infer<typeof trendPointSchema>;

export const trendsResponseSchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  /** Every date in the range, oldest first. */
  items: z.array(trendPointSchema),
});

export const teamDayItemSchema = z.object({
  employee: reportEmployeeSchema,
  state: z.enum(TEAM_DAY_STATES),
  record: attendanceResponseSchema.nullable(),
});

export const teamDayResponseSchema = z.object({
  serverTime: z.iso.datetime(),
  workDate: z.iso.date(),
  timezone: z.string(),
  isWorkingDay: z.boolean(),
  nonWorkingReason: z.enum(NON_WORKING_REASONS).nullable(),
  /** Card counts (UX_FLOWS.md §10); each matches the items with that state or status. */
  summary: z.object({
    employees: z.int(),
    present: z.int(),
    late: z.int(),
    notCheckedIn: z.int(),
    notCheckedOut: z.int(),
    absent: z.int(),
  }),
  items: z.array(teamDayItemSchema),
});

export type TeamDayResponseBody = z.infer<typeof teamDayResponseSchema>;

export const organizationDashboardSchema = z.object({
  serverTime: z.iso.datetime(),
  workDate: z.iso.date(),
  timezone: z.string(),
  isWorkingDay: z.boolean(),
  nonWorkingReason: z.enum(NON_WORKING_REASONS).nullable(),
  /** Today's check-in window has closed: "not checked in" is final until close-day. */
  checkInWindowClosed: z.boolean(),
  /** Active and employed today. */
  activeEmployees: z.int(),
  present: z.int(),
  late: z.int(),
  /** ABSENT records (close-day runs after midnight, so 0 for today until then). */
  absent: z.int(),
  /** Active employees without a record yet on a working day. */
  notCheckedIn: z.int(),
  /** Open records past their scheduled end. */
  notCheckedOut: z.int(),
  pendingCorrections: z.int(),
  /** The last 30 working days, ending today. */
  trend: z.array(trendPointSchema),
});

export type OrganizationDashboardBody = z.infer<typeof organizationDashboardSchema>;

export class ReportResponse extends createZodDto(reportResponseSchema) {}
export class TrendsResponse extends createZodDto(trendsResponseSchema) {}
export class TeamDayResponse extends createZodDto(teamDayResponseSchema) {}
export class TeamHistoryResponse extends createZodDto(paginated(reportRecordSchema)) {}
export class OrganizationDashboardResponse extends createZodDto(organizationDashboardSchema) {}
