import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { employeeFieldsSchema } from "@/modules/employees/dto/create-employee.dto.js";

// Status changes go through /deactivate and /reactivate; the account through /account.
// The employment period is checked against the stored dates in the service.
export const updateEmployeeSchema = employeeFieldsSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Change at least one field" });

export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

export class UpdateEmployeeDto extends createZodDto(updateEmployeeSchema) {}
