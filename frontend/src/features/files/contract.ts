import type {
  createUploadResponseSchema,
  createUploadSchema,
  uploadListSchema,
  uploadSchema,
} from "@/features/files/schemas";
import type { ApiSchema, Equal, Expect } from "@/lib/api/contract";

import type { z } from "zod";

// Compile-time checks: must match the backend contract (docs/08-data-fetching.md).
export type _CreateUpload = Expect<
  Equal<z.output<typeof createUploadSchema>, ApiSchema<"CreateUploadDto">>
>;
export type _Upload = Expect<
  Equal<z.output<typeof uploadSchema>, ApiSchema<"UploadResponse_Output">>
>;
export type _UploadList = Expect<
  Equal<z.output<typeof uploadListSchema>, ApiSchema<"UploadListResponse_Output">>
>;
export type _CreateUploadResponse = Expect<
  Equal<z.output<typeof createUploadResponseSchema>, ApiSchema<"CreateUploadResponse_Output">>
>;
