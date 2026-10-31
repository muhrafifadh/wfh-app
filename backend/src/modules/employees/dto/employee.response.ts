import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { paginated } from "@/common/dto/pagination.js";
import { EMPLOYEE_STATUSES } from "@/modules/employees/employees.constants.js";
import { roleSummarySchema } from "@/modules/users/dto/user.response.js";
import { USER_STATUSES } from "@/modules/users/users.constants.js";

export const employeeResponseSchema = z.object({
  id: z.uuid(),
  employeeNumber: z.string(),
  fullName: z.string(),
  workEmail: z.email().nullable(),
  jobTitle: z.string().nullable(),
  status: z.enum(EMPLOYEE_STATUSES),
  employmentStartDate: z.iso.date(),
  employmentEndDate: z.iso.date().nullable(),
  division: z.object({ id: z.uuid(), code: z.string(), name: z.string() }),
  manager: z.object({ id: z.uuid(), employeeNumber: z.string(), fullName: z.string() }).nullable(),
  /** The user this employee signs in as; null until invited or linked. */
  account: z
    .object({
      id: z.uuid(),
      email: z.email(),
      role: roleSummarySchema,
      status: z.enum(USER_STATUSES),
    })
    .nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type EmployeeResponseBody = z.infer<typeof employeeResponseSchema>;

export class EmployeeResponse extends createZodDto(employeeResponseSchema) {}
export class EmployeeListResponse extends createZodDto(paginated(employeeResponseSchema)) {}
