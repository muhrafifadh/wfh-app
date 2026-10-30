import type { correctionListSchema, correctionSchema } from "@/features/corrections/schemas";
import type { ApiSchema, Equal, Expect } from "@/lib/api/contract";

import type { z } from "zod";

// Compile-time checks: these schemas must match the backend contract exactly.
// If one fails, run `pnpm api:types` and update the schema (see docs/08-data-fetching.md).

export type _Correction = Expect<
  Equal<z.output<typeof correctionSchema>, ApiSchema<"CorrectionResponse_Output">>
>;
export type _CorrectionList = Expect<
  Equal<z.output<typeof correctionListSchema>, ApiSchema<"CorrectionListResponse_Output">>
>;
