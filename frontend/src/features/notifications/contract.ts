import type {
  emailPreferencesSchema,
  markAllReadSchema,
  notificationListSchema,
  unreadCountSchema,
} from "@/features/notifications/schemas";
import type { ApiSchema, Equal, Expect } from "@/lib/api/contract";

import type { z } from "zod";

// Compile-time checks: these schemas must match the backend contract exactly.
// If one fails, run `pnpm api:types` and update the schema (see docs/08-data-fetching.md).

// What we send
export type _UpdatePreferences = Expect<
  Equal<z.output<typeof emailPreferencesSchema>, ApiSchema<"UpdateEmailPreferencesDto">>
>;

// What we receive
export type _List = Expect<
  Equal<z.output<typeof notificationListSchema>, ApiSchema<"NotificationListResponse_Output">>
>;
export type _UnreadCount = Expect<
  Equal<z.output<typeof unreadCountSchema>, ApiSchema<"UnreadCountResponse_Output">>
>;
export type _MarkAllRead = Expect<
  Equal<z.output<typeof markAllReadSchema>, ApiSchema<"MarkAllReadResponse_Output">>
>;
export type _Preferences = Expect<
  Equal<z.output<typeof emailPreferencesSchema>, ApiSchema<"EmailPreferencesResponse_Output">>
>;
