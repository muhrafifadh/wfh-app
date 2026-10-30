import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const createHolidaySchema = z.strictObject({
  /** The organization's local date. Past dates are allowed and audited (DOMAIN_RULES.md §6.3). */
  date: z.iso.date("Use YYYY-MM-DD"),
  name: z.string().trim().min(1, "Enter a name").max(160, "Use at most 160 characters"),
});

export type CreateHolidayInput = z.infer<typeof createHolidaySchema>;

export class CreateHolidayDto extends createZodDto(createHolidaySchema) {}
