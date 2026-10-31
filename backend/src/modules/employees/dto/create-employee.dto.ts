import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { emailSchema } from "@/modules/auth/dto/password.js";
import { EMPLOYEE_NUMBER_PATTERN } from "@/modules/employees/employees.constants.js";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use at most ${max} characters`)
    .transform((value) => value || null)
    .nullable()
    .optional();

/** The fields an admin can edit after creation (the employee number is fixed). */
export const employeeFieldsSchema = z.strictObject({
  fullName: z.string().trim().min(1, "Enter a name").max(160, "Use at most 160 characters"),
  workEmail: emailSchema.nullable().optional(),
  jobTitle: optionalText(120),
  divisionId: z.uuid("Choose a division"),
  managerId: z.uuid("Choose a manager").nullable().optional(),
  employmentStartDate: z.iso.date("Use YYYY-MM-DD"),
  employmentEndDate: z.iso.date("Use YYYY-MM-DD").nullable().optional(),
});

export const createEmployeeSchema = employeeFieldsSchema
  .extend({
    /** Uppercased before it's checked, so "emp-001" becomes "EMP-001". */
    employeeNumber: z
      .string()
      .trim()
      .toUpperCase()
      .regex(EMPLOYEE_NUMBER_PATTERN, "Use 3–32 letters, digits or hyphens, e.g. EMP-001"),
  })
  .refine((v) => !v.employmentEndDate || v.employmentEndDate >= v.employmentStartDate, {
    path: ["employmentEndDate"],
    message: "Must be on or after the start date",
  });

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

export class CreateEmployeeDto extends createZodDto(createEmployeeSchema) {}
