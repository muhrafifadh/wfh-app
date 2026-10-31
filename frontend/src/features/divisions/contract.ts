import type {
  divisionFormSchema,
  divisionListSchema,
  divisionSchema,
} from "@/features/divisions/schemas";
import type { ApiSchema, Equal, Expect } from "@/lib/api/contract";

import type { z } from "zod";

// Compile-time checks: these schemas must match the backend contract exactly.
// If one fails, run `pnpm api:types` and update the schema (see docs/08-data-fetching.md).

// What we send (the form always sends both fields; PATCH accepts either)
export type _CreateDivision = Expect<
  Equal<z.output<typeof divisionFormSchema>, ApiSchema<"CreateDivisionDto">>
>;
export type _UpdateDivision = Expect<
  Equal<Partial<z.output<typeof divisionFormSchema>>, ApiSchema<"UpdateDivisionDto">>
>;

// What we receive
export type _Division = Expect<
  Equal<z.output<typeof divisionSchema>, ApiSchema<"DivisionResponse_Output">>
>;
export type _DivisionList = Expect<
  Equal<z.output<typeof divisionListSchema>, ApiSchema<"DivisionListResponse_Output">>
>;
