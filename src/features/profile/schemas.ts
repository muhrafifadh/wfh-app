import { z } from "zod";

import { ACCOUNT_STATUSES, EMPLOYEE_STATUSES } from "@/features/profile/constants";

// Backend response shapes (backend src/modules/employees/dto), checked in contract.ts

/** GET /me/context: what the app shell shows on every page. */
export const meContextSchema = z.object({
  organization: z.object({
    name: z.string(),
    timezone: z.string(),
    supportContact: z.string().nullable(),
  }),
  employee: z
    .object({
      id: z.string(),
      employeeNumber: z.string(),
      fullName: z.string(),
      status: z.enum(EMPLOYEE_STATUSES),
    })
    .nullable(),
});
export type MeContext = z.infer<typeof meContextSchema>;

/** GET /me/employee: the caller's own employee profile. */
export const myEmployeeSchema = z.object({
  id: z.string(),
  employeeNumber: z.string(),
  fullName: z.string(),
  workEmail: z.string().nullable(),
  jobTitle: z.string().nullable(),
  status: z.enum(EMPLOYEE_STATUSES),
  employmentStartDate: z.iso.date(),
  employmentEndDate: z.iso.date().nullable(),
  division: z.object({ id: z.string(), code: z.string(), name: z.string() }),
  manager: z
    .object({ id: z.string(), employeeNumber: z.string(), fullName: z.string() })
    .nullable(),
  account: z
    .object({
      id: z.string(),
      email: z.string(),
      role: z.object({ id: z.string(), name: z.string() }),
      status: z.enum(ACCOUNT_STATUSES),
    })
    .nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type MyEmployee = z.infer<typeof myEmployeeSchema>;
