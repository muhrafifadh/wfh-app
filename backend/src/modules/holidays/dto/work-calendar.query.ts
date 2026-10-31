import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { addDays } from "@/common/time/zoned-time.js";
import { MAX_CALENDAR_DAYS } from "@/modules/holidays/holidays.constants.js";

export const workCalendarQuerySchema = z
  .strictObject({ from: z.iso.date(), to: z.iso.date() })
  .refine((q) => q.from <= q.to, { path: ["to"], message: "Must be on or after from" })
  .refine((q) => q.to <= addDays(q.from, MAX_CALENDAR_DAYS - 1), {
    path: ["to"],
    message: `Use a range of at most ${MAX_CALENDAR_DAYS} days`,
  });

export type WorkCalendarQueryInput = z.infer<typeof workCalendarQuerySchema>;

export class WorkCalendarQuery extends createZodDto(workCalendarQuerySchema) {}
