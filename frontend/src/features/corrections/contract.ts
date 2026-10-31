import type {
  approveSchema,
  correctionListSchema,
  correctionPreviewSchema,
  correctionSchema,
  previewCorrectionSchema,
  rejectSchema,
  submitCorrectionSchema,
} from "@/features/corrections/schemas";
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
export type _CorrectionPreview = Expect<
  Equal<z.output<typeof correctionPreviewSchema>, ApiSchema<"CorrectionPreviewResponse_Output">>
>;
export type _SubmitCorrection = Expect<
  Equal<
    Required<z.output<typeof submitCorrectionSchema>>,
    Required<ApiSchema<"SubmitCorrectionDto">>
  >
>;
export type _PreviewCorrection = Expect<
  Equal<
    Required<z.output<typeof previewCorrectionSchema>>,
    Required<ApiSchema<"PreviewCorrectionDto">>
  >
>;
export type _Approve = Expect<
  Equal<Required<z.output<typeof approveSchema>>, Required<ApiSchema<"ApproveCorrectionDto">>>
>;
export type _Reject = Expect<
  Equal<z.output<typeof rejectSchema>, ApiSchema<"RejectCorrectionDto">>
>;
