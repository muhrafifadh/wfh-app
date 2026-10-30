import "server-only";

import { cache } from "react";

import { workScheduleListSchema, workSettingsSchema } from "@/features/work-settings/schemas";
import { apiFetch } from "@/lib/api/client";

// docs/08-data-fetching.md — reads for the attendance settings page (policy:manage).

export const getWorkSettings = cache(() =>
  apiFetch("/work-settings", { schema: workSettingsSchema }),
);

/** Schedule versions, newest first. */
export const listSchedules = cache(
  async () =>
    (await apiFetch("/work-schedules?pageSize=20", { schema: workScheduleListSchema })).items,
);
