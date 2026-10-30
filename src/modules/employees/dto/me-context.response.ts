import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { EMPLOYEE_STATUSES } from "@/modules/employees/employees.constants.js";

/** What the app shell needs on every page, readable by any signed-in user. */
export const meContextResponseSchema = z.object({
  organization: z.object({
    name: z.string(),
    /** The zone of the schedule in force today (DOMAIN_RULES §5.3). */
    timezone: z.string(),
    supportContact: z.string().nullable(),
  }),
  /** Null when the user records no attendance (e.g. an Admin/HR-only account). */
  employee: z
    .object({
      id: z.uuid(),
      employeeNumber: z.string(),
      fullName: z.string(),
      status: z.enum(EMPLOYEE_STATUSES),
    })
    .nullable(),
});

export type MeContextResponseBody = z.infer<typeof meContextResponseSchema>;

export class MeContextResponse extends createZodDto(meContextResponseSchema) {}
