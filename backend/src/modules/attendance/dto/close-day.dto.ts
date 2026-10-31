import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const closeDaySchema = z.strictObject({
  /** A work date that has ended (before today in the organization's zone). */
  date: z.iso.date("Use YYYY-MM-DD"),
});

export class CloseDayDto extends createZodDto(closeDaySchema) {}

export class CloseDayResponse extends createZodDto(
  z.object({
    runId: z.string(),
    workDate: z.iso.date(),
    isWorkingDay: z.boolean(),
    reason: z.enum(["no_schedule", "non_working_day", "holiday"]).nullable(),
    created: z.int(),
    skipped: z.int(),
    failed: z.int(),
  }),
) {}
