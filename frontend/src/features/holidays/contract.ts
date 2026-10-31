import type {
  holidayFormSchema,
  holidayListSchema,
  holidaySchema,
} from "@/features/holidays/schemas";
import type { ApiSchema, Equal, Expect } from "@/lib/api/contract";

import type { z } from "zod";

// Compile-time checks: these schemas must match the backend contract exactly.
// If one fails, run `pnpm api:types` and update the schema (see docs/08-data-fetching.md).

export type _CreateHoliday = Expect<
  Equal<z.output<typeof holidayFormSchema>, ApiSchema<"CreateHolidayDto">>
>;
export type _UpdateHoliday = Expect<
  Equal<Partial<z.output<typeof holidayFormSchema>>, ApiSchema<"UpdateHolidayDto">>
>;
export type _Holiday = Expect<
  Equal<z.output<typeof holidaySchema>, ApiSchema<"HolidayResponse_Output">>
>;
export type _HolidayList = Expect<
  Equal<z.output<typeof holidayListSchema>, ApiSchema<"HolidayListResponse_Output">>
>;
