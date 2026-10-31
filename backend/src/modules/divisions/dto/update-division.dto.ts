import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { createDivisionSchema } from "@/modules/divisions/dto/create-division.dto.js";

// Status changes go through /deactivate and /reactivate.
export const updateDivisionSchema = createDivisionSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Change at least one field" });

export type UpdateDivisionInput = z.infer<typeof updateDivisionSchema>;

export class UpdateDivisionDto extends createZodDto(updateDivisionSchema) {}
