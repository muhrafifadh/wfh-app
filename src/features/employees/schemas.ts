import { z } from "zod";

import {
  ACCOUNT_STATUSES,
  EMPLOYEE_NUMBER_PATTERN,
  EMPLOYEE_STATUSES,
} from "@/features/employees/constants";

// Backend response shapes (backend src/modules/employees/dto), checked in contract.ts

export const employeeSchema = z.object({
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
  /** The user this employee signs in as; null until invited or linked. */
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
export type Employee = z.infer<typeof employeeSchema>;

export const employeeListSchema = z.object({
  items: z.array(employeeSchema),
  page: z.int(),
  pageSize: z.int(),
  total: z.int(),
});

// Options for the form and filter selects (only the fields the selects use)

export const divisionOptionsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      code: z.string(),
      name: z.string(),
      status: z.enum(["active", "inactive"]),
    }),
  ),
});
export type DivisionOption = z.infer<typeof divisionOptionsSchema>["items"][number];

export const roleOptionsSchema = z.object({
  items: z.array(z.object({ id: z.string(), name: z.string() })),
});
export type RoleOption = z.infer<typeof roleOptionsSchema>["items"][number];

export const userOptionsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      status: z.enum(ACCOUNT_STATUSES),
    }),
  ),
});
export type UserOption = z.infer<typeof userOptionsSchema>["items"][number];

// What we send

export const employeeIdSchema = z.uuid();

/** "" from an empty input means "not set". */
const optional = <T extends z.ZodType>(schema: T) =>
  z.union([z.literal("").transform(() => null), schema]);
const optionalText = (max: number) =>
  optional(z.string().trim().max(max, `Use at most ${max} characters`)).transform(
    (value) => value || null,
  );

/** Employment details: what PATCH /employees/:id accepts (all fields, always sent). */
export const employeeDetailsSchema = z.object({
  fullName: z.string().trim().min(1, "Enter a full name").max(160, "Use at most 160 characters"),
  workEmail: optional(z.string().trim().max(254).pipe(z.email("Enter a valid email"))),
  jobTitle: optionalText(120),
  divisionId: z.uuid("Choose a division"),
  managerId: optional(z.uuid("Choose a manager")),
  employmentStartDate: z.iso.date("Choose a start date"),
  employmentEndDate: optional(z.iso.date("Choose a valid date")),
});
export type EmployeeDetailsInput = z.input<typeof employeeDetailsSchema>;
export type EmployeeDetails = z.output<typeof employeeDetailsSchema>;

/** POST /employees: the details plus the employee number, which can't change later. */
export const createEmployeeSchema = employeeDetailsSchema.extend({
  // UX_FLOWS.md §12.2: normalized to uppercase
  employeeNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(EMPLOYEE_NUMBER_PATTERN, "Use 3–32 letters, digits or dashes, e.g. EMP-011"),
});
export type CreateEmployee = z.output<typeof createEmployeeSchema>;

/** The add-employee form: the employee, plus the role their account gets (blank: no account yet). */
export const newEmployeeFormSchema = createEmployeeSchema
  .extend({ roleId: optional(z.uuid("Choose a role")) })
  .refine((value) => !value.roleId || value.workEmail, {
    path: ["workEmail"],
    message: "Enter a work email to give them an account",
  });
export type NewEmployeeFormInput = z.input<typeof newEmployeeFormSchema>;
export type NewEmployeeForm = z.output<typeof newEmployeeFormSchema>;

export const inviteAccountSchema = z.object({
  email: z.string().trim().max(254).pipe(z.email("Enter a valid email")),
  roleId: z.uuid("Choose a role"),
});
export type InviteAccountInput = z.infer<typeof inviteAccountSchema>;

export const linkAccountSchema = z.object({
  userId: z.uuid("Choose a user"),
  /** Blank keeps the user's current role. */
  roleId: optional(z.uuid("Choose a role")),
});
export type LinkAccountInput = z.input<typeof linkAccountSchema>;
export type LinkAccount = z.output<typeof linkAccountSchema>;

export const accountRoleSchema = z.object({ roleId: z.uuid("Choose a role") });
