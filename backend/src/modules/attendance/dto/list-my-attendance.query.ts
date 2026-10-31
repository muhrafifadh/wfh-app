import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { paginationQuerySchema } from "@/common/dto/pagination.js";
import { addDays } from "@/common/time/zoned-time.js";
import { ATTENDANCE_STATUSES, MAX_RANGE_DAYS } from "@/modules/attendance/attendance.constants.js";

const rangeRefinements = <T extends z.ZodType<{ from?: string; to?: string }>>(schema: T) =>
  schema
    .refine((q) => !q.from || !q.to || q.from <= q.to, {
      path: ["to"],
      message: "Must be on or after from",
    })
    .refine((q) => !q.from || !q.to || q.to <= addDays(q.from, MAX_RANGE_DAYS - 1), {
      path: ["to"],
      message: `Use a range of at most ${MAX_RANGE_DAYS} days`,
    });

/** Newest work date first. Dates are work dates (organization zone), inclusive. */
export const listMyAttendanceQuerySchema = rangeRefinements(
  paginationQuerySchema.extend({
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    status: z.enum(ATTENDANCE_STATUSES).optional(),
    /** Only open records past their check-out deadline ("Missing check-out"). */
    incomplete: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
  }),
);

export type ListMyAttendanceQueryInput = z.infer<typeof listMyAttendanceQuerySchema>;

export class ListMyAttendanceQuery extends createZodDto(listMyAttendanceQuerySchema) {}

/** Either a month ("2026-11") or a from/to range. */
export const attendanceSummaryQuerySchema = rangeRefinements(
  z.strictObject({
    month: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use YYYY-MM")
      .optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  }),
).refine((q) => (q.month !== undefined) !== (q.from !== undefined && q.to !== undefined), {
  path: ["month"],
  message: "Give either month, or both from and to",
});

export type AttendanceSummaryQueryInput = z.infer<typeof attendanceSummaryQuerySchema>;

export class AttendanceSummaryQuery extends createZodDto(attendanceSummaryQuerySchema) {}
