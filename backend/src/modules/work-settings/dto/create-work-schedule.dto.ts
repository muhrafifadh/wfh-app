import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { isValidTimeZone, parseTimeOfDay } from "@/common/time/zoned-time.js";
import { timeOrderErrors } from "@/modules/work-settings/domain/schedule-policy.js";

/** "09:00" or "09:00:00" (or "23:59:59.999" with `milliseconds`) → ms since midnight. */
const timeOfDay = (options: { milliseconds?: boolean } = {}) =>
  z
    .string()
    .regex(
      options.milliseconds ? /^\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/ : /^\d{2}:\d{2}(:\d{2})?$/,
      options.milliseconds ? "Use HH:MM, HH:MM:SS or HH:MM:SS.sss" : "Use HH:MM or HH:MM:SS",
    )
    .transform((value, ctx) => {
      const ms = parseTimeOfDay(value);
      if (ms === null) {
        ctx.addIssue({ code: "custom", message: "Not a valid time of day" });
        return z.NEVER;
      }
      return ms;
    });

export const timezoneSchema = z
  .string()
  .trim()
  .max(64)
  .refine(isValidTimeZone, "Use an IANA time zone, e.g. Asia/Jakarta");

export const workSchedulePolicySchema = z.strictObject({
  name: z.string().trim().min(1, "Enter a name").max(120, "Use at most 120 characters"),
  timezone: timezoneSchema,
  /** ISO weekdays, 1 = Monday … 7 = Sunday. Stored sorted. */
  workingDays: z
    .array(z.int().min(1).max(7))
    .min(1, "Choose at least one working day")
    .max(7)
    .refine((days) => new Set(days).size === days.length, "Each day once")
    .transform((days) => [...days].sort((a, b) => a - b)),
  startTime: timeOfDay(),
  endTime: timeOfDay(),
  toleranceMinutes: z.int().min(0).max(120, "Use at most 120 minutes"),
  checkInOpensAt: timeOfDay(),
  checkInClosesAt: timeOfDay(),
  checkOutDeadline: timeOfDay({ milliseconds: true }),
  /** First day of the new version; the day after "today" at the earliest (checked by the service). */
  effectiveFrom: z.iso.date("Use YYYY-MM-DD"),
});

/** A new schedule version. It stays in force until a later version replaces it. */
export const createWorkScheduleSchema = workSchedulePolicySchema.superRefine((value, ctx) => {
  for (const [field, message] of Object.entries(timeOrderErrors(value))) {
    ctx.addIssue({ code: "custom", path: [field], message });
  }
});

export type CreateWorkScheduleInput = z.infer<typeof createWorkScheduleSchema>;

export class CreateWorkScheduleDto extends createZodDto(createWorkScheduleSchema) {}
