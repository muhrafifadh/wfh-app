import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { paginationQuerySchema, sortValues } from "@/common/dto/pagination.js";
import {
  EMPLOYEE_SORT_FIELDS,
  EMPLOYEE_STATUSES,
} from "@/modules/employees/employees.constants.js";

export const listEmployeesQuerySchema = paginationQuerySchema.extend({
  /** Matches name, employee number or work email. */
  q: z.string().trim().max(100).optional(),
  status: z.enum(EMPLOYEE_STATUSES).optional(),
  divisionId: z.uuid().optional(),
  managerId: z.uuid().optional(),
  sort: z.enum(sortValues(EMPLOYEE_SORT_FIELDS)).default("employeeNumber"),
});

export type ListEmployeesQueryInput = z.infer<typeof listEmployeesQuerySchema>;

export class ListEmployeesQuery extends createZodDto(listEmployeesQuerySchema) {}
