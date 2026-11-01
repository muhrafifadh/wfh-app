import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { parseTimeOfDay } from "@/common/time/zoned-time.js";

/** "09:00" → ms since local midnight (DOMAIN_RULES.md §18.4: whole minutes). */
const reminderTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM")
  .transform((value) => parseTimeOfDay(value) as number);

/**
 * The time zone isn't here: it belongs to the schedule, and changes only through a
 * new schedule version with a future effective date (DOMAIN_RULES.md §5.3).
 */
export const updateWorkSettingsSchema = z
  .strictObject({
    supportContact: z
      .string()
      .trim()
      .max(255, "Use at most 255 characters")
      .transform((value) => value || null)
      .nullable(),
    retentionYears: z.int().min(1).max(10, "Use 1–10 years"),
    checkInReminderEnabled: z.boolean(),
    checkInReminderTime: reminderTime,
    checkOutReminderEnabled: z.boolean(),
    checkOutReminderTime: reminderTime,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Change at least one field" });

export type UpdateWorkSettingsInput = z.infer<typeof updateWorkSettingsSchema>;

export class UpdateWorkSettingsDto extends createZodDto(updateWorkSettingsSchema) {}
