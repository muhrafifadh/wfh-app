import type {
  createEmployeeSchema,
  employeeDetailsSchema,
  employeeListSchema,
  employeeSchema,
} from "@/features/employees/schemas";
import type { ApiSchema, Equal, Expect } from "@/lib/api/contract";

import type { z } from "zod";

// Compile-time checks: these schemas must match the backend contract exactly.
// If one fails, run `pnpm api:types` and update the schema (see docs/08-data-fetching.md).

// What we send. The forms always send every field (null clears one), so the
// optional API fields are compared as required.
export type _CreateEmployee = Expect<
  Equal<z.output<typeof createEmployeeSchema>, Required<ApiSchema<"CreateEmployeeDto">>>
>;
export type _UpdateEmployee = Expect<
  Equal<z.output<typeof employeeDetailsSchema>, Required<ApiSchema<"UpdateEmployeeDto">>>
>;

// What we receive
export type _Employee = Expect<
  Equal<z.output<typeof employeeSchema>, ApiSchema<"EmployeeResponse_Output">>
>;
export type _EmployeeList = Expect<
  Equal<z.output<typeof employeeListSchema>, ApiSchema<"EmployeeListResponse_Output">>
>;
