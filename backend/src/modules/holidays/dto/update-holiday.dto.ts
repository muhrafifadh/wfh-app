import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { createHolidaySchema } from "@/modules/holidays/dto/create-holiday.dto.js";

export const updateHolidaySchema = createHolidaySchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Change at least one field" });

export type UpdateHolidayInput = z.infer<typeof updateHolidaySchema>;

export class UpdateHolidayDto extends createZodDto(updateHolidaySchema) {}
