import { createZodDto } from "nestjs-zod";
import { z } from "zod";

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
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Change at least one field" });

export type UpdateWorkSettingsInput = z.infer<typeof updateWorkSettingsSchema>;

export class UpdateWorkSettingsDto extends createZodDto(updateWorkSettingsSchema) {}
