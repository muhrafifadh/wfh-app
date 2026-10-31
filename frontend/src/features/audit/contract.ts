import type { auditLogListSchema } from "@/features/audit/schemas";
import type { ApiSchema, Equal, Expect } from "@/lib/api/contract";

import type { z } from "zod";

// Compile-time check: must match the backend contract (docs/08-data-fetching.md).
export type _AuditLogList = Expect<
  Equal<z.output<typeof auditLogListSchema>, ApiSchema<"AuditLogListResponse_Output">>
>;
