import type {
  organizationDashboardSchema,
  reportSchema,
  teamDaySchema,
  teamHistorySchema,
  trendsSchema,
} from "@/features/reports/schemas";
import type { ApiSchema, Equal, Expect } from "@/lib/api/contract";

import type { z } from "zod";

// Compile-time checks: these schemas must match the backend contract exactly.
// If one fails, run `pnpm api:types` and update the schema (see docs/08-data-fetching.md).

export type _Report = Expect<
  Equal<z.output<typeof reportSchema>, ApiSchema<"ReportResponse_Output">>
>;
export type _Trends = Expect<
  Equal<z.output<typeof trendsSchema>, ApiSchema<"TrendsResponse_Output">>
>;
export type _TeamDay = Expect<
  Equal<z.output<typeof teamDaySchema>, ApiSchema<"TeamDayResponse_Output">>
>;
export type _TeamHistory = Expect<
  Equal<z.output<typeof teamHistorySchema>, ApiSchema<"TeamHistoryResponse_Output">>
>;
export type _OrganizationDashboard = Expect<
  Equal<
    z.output<typeof organizationDashboardSchema>,
    ApiSchema<"OrganizationDashboardResponse_Output">
  >
>;
