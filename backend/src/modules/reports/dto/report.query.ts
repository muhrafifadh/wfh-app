import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { paginationQuerySchema } from "@/common/dto/pagination.js";
import { addDays } from "@/common/time/zoned-time.js";
import { ATTENDANCE_STATUSES } from "@/modules/attendance/attendance.constants.js";
import { MAX_REPORT_DAYS, REPORT_COMPLETIONS } from "@/modules/reports/reports.constants.js";

const ordered = (q: { from?: string; to?: string }) => !q.from || !q.to || q.from <= q.to;
const withinMax = (q: { from?: string; to?: string }) =>
  !q.from || !q.to || q.to <= addDays(q.from, MAX_REPORT_DAYS - 1);
const rangeChecks = {
  ordered: { path: ["to"], message: "Must be on or after from" },
  max: { path: ["to"], message: `Use a range of at most ${MAX_REPORT_DAYS} days` },
};

/** Dates are work dates (organization zone), inclusive; the range is required. */
const reportFilterSchema = z.object({
  from: z.iso.date("Use YYYY-MM-DD"),
  to: z.iso.date("Use YYYY-MM-DD"),
  employeeId: z.uuid().optional(),
  divisionId: z.uuid().optional(),
});

export const reportQuerySchema = paginationQuerySchema
  .extend(reportFilterSchema.shape)
  .extend({
    status: z.enum(ATTENDANCE_STATUSES).optional(),
    completion: z.enum(REPORT_COMPLETIONS).optional(),
  })
  .refine(ordered, rangeChecks.ordered)
  .refine(withinMax, rangeChecks.max);

export type ReportQueryInput = z.infer<typeof reportQuerySchema>;

export class ReportQuery extends createZodDto(reportQuerySchema) {}

/** The CSV has the report's filters and order, without pagination (the full result). */
export const reportExportQuerySchema = reportFilterSchema
  .extend({
    status: z.enum(ATTENDANCE_STATUSES).optional(),
    completion: z.enum(REPORT_COMPLETIONS).optional(),
  })
  .refine(ordered, rangeChecks.ordered)
  .refine(withinMax, rangeChecks.max);

export type ReportExportQueryInput = z.infer<typeof reportExportQuerySchema>;

export class ReportExportQuery extends createZodDto(reportExportQuerySchema) {}

export const trendsQuerySchema = reportFilterSchema
  .refine(ordered, rangeChecks.ordered)
  .refine(withinMax, rangeChecks.max);

export type TrendsQueryInput = z.infer<typeof trendsQuerySchema>;

export class TrendsQuery extends createZodDto(trendsQuerySchema) {}

/** Today's organization dashboard, optionally narrowed. */
export const dashboardQuerySchema = z.object({
  employeeId: z.uuid().optional(),
  divisionId: z.uuid().optional(),
});

export type DashboardQueryInput = z.infer<typeof dashboardQuerySchema>;

export class DashboardQuery extends createZodDto(dashboardQuerySchema) {}

/** A day of the team (default today, within the last 90 days). */
export const teamDayQuerySchema = z.object({ date: z.iso.date("Use YYYY-MM-DD").optional() });

export type TeamDayQueryInput = z.infer<typeof teamDayQuerySchema>;

export class TeamDayQuery extends createZodDto(teamDayQuerySchema) {}

/** Direct reports' records; defaults to the last 90 days. */
export const teamHistoryQuerySchema = paginationQuerySchema
  .extend({
    from: z.iso.date("Use YYYY-MM-DD").optional(),
    to: z.iso.date("Use YYYY-MM-DD").optional(),
    employeeId: z.uuid().optional(),
    status: z.enum(ATTENDANCE_STATUSES).optional(),
    completion: z.enum(REPORT_COMPLETIONS).optional(),
  })
  .refine(ordered, rangeChecks.ordered);

export type TeamHistoryQueryInput = z.infer<typeof teamHistoryQuerySchema>;

export class TeamHistoryQuery extends createZodDto(teamHistoryQuerySchema) {}
