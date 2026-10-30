import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { workScheduleResponseSchema } from "@/modules/work-settings/dto/work-schedule.response.js";

export const workSettingsResponseSchema = z.object({
  /** The zone of today's schedule, or the organization default before there is one. */
  timezone: z.string(),
  supportContact: z.string().nullable(),
  retentionYears: z.int(),
  /** Today's work date in that zone. */
  workDate: z.iso.date(),
  /** The earliest date a new schedule version can take effect. */
  earliestEffectiveFrom: z.iso.date(),
  currentSchedule: workScheduleResponseSchema.nullable(),
});

export type WorkSettingsResponseBody = z.infer<typeof workSettingsResponseSchema>;

export class WorkSettingsResponse extends createZodDto(workSettingsResponseSchema) {}
