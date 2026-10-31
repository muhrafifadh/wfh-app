import type { meContextSchema, myEmployeeSchema } from "@/features/profile/schemas";
import type { ApiSchema, Equal, Expect } from "@/lib/api/contract";

import type { z } from "zod";

// Compile-time checks: these schemas must match the backend contract exactly.
// If one fails, run `pnpm api:types` and update the schema (see docs/08-data-fetching.md).

export type _MeContext = Expect<
  Equal<z.output<typeof meContextSchema>, ApiSchema<"MeContextResponse_Output">>
>;
export type _MyEmployee = Expect<
  Equal<z.output<typeof myEmployeeSchema>, ApiSchema<"EmployeeResponse_Output">>
>;
