import type {
  attendanceListSchema,
  attendanceSchema,
  attendanceSummarySchema,
  todaySchema,
} from "@/features/attendance/schemas";
import type { ApiSchema, Equal, Expect } from "@/lib/api/contract";

import type { z } from "zod";

// Compile-time checks: these schemas must match the backend contract exactly.
// If one fails, run `pnpm api:types` and update the schema (see docs/08-data-fetching.md).

export type _Attendance = Expect<
  Equal<z.output<typeof attendanceSchema>, ApiSchema<"AttendanceResponse_Output">>
>;
export type _AttendanceList = Expect<
  Equal<z.output<typeof attendanceListSchema>, ApiSchema<"AttendanceListResponse_Output">>
>;
export type _Today = Expect<Equal<z.output<typeof todaySchema>, ApiSchema<"TodayResponse_Output">>>;
export type _AttendanceSummary = Expect<
  Equal<z.output<typeof attendanceSummarySchema>, ApiSchema<"AttendanceSummaryResponse_Output">>
>;
