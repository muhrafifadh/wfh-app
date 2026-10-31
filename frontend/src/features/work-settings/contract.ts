import type {
  organizationSettingsSchema,
  scheduleFormSchema,
  schedulePreviewSchema,
  workScheduleListSchema,
  workSettingsSchema,
} from "@/features/work-settings/schemas";
import type { ApiSchema, Equal, Expect } from "@/lib/api/contract";

import type { z } from "zod";

// Compile-time checks: these schemas must match the backend contract exactly.
// If one fails, run `pnpm api:types` and update the schema (see docs/08-data-fetching.md).

// What we send (the settings form always sends both fields)
export type _UpdateSettings = Expect<
  Equal<z.output<typeof organizationSettingsSchema>, Required<ApiSchema<"UpdateWorkSettingsDto">>>
>;
export type _CreateSchedule = Expect<
  Equal<z.output<typeof scheduleFormSchema>, ApiSchema<"CreateWorkScheduleDto">>
>;

// What we receive
export type _Settings = Expect<
  Equal<z.output<typeof workSettingsSchema>, ApiSchema<"WorkSettingsResponse_Output">>
>;
export type _ScheduleList = Expect<
  Equal<z.output<typeof workScheduleListSchema>, ApiSchema<"WorkScheduleListResponse_Output">>
>;
export type _Preview = Expect<
  Equal<z.output<typeof schedulePreviewSchema>, ApiSchema<"WorkSchedulePreviewResponse_Output">>
>;
