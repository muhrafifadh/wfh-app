import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { DIVISION_CODE_PATTERN } from "@/modules/divisions/divisions.constants.js";

export const createDivisionSchema = z.strictObject({
  /** Uppercased before it's checked, so "eng" becomes "ENG". */
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(DIVISION_CODE_PATTERN, "Use 2–32 letters, digits or hyphens"),
  name: z.string().trim().min(1, "Enter a name").max(120, "Use at most 120 characters"),
});

export type CreateDivisionInput = z.infer<typeof createDivisionSchema>;

export class CreateDivisionDto extends createZodDto(createDivisionSchema) {}
