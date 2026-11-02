import "server-only";

import { cache } from "react";

import {
  myResultsSchema,
  myVerificationSchema,
  photoRequestListSchema,
  verificationListSchema,
  verificationSettingsSchema,
  workLocationRequestListSchema,
} from "@/features/attendance-verification/schemas";
import type { VerificationFilters } from "@/features/attendance-verification/search-params";
import { apiFetch } from "@/lib/api/client";

// docs/08-data-fetching.md — reads for attendance verification (ATTENDANCE_VERIFICATION_PLAN.md).

/** The employee's card. Both methods off means the card shows nothing. */
export const getMyVerification = cache(() =>
  apiFetch("/attendance-verification/me", { schema: myVerificationSchema }),
);

export const listMyResults = cache(
  async () =>
    (await apiFetch("/attendance-verification/me/results", { schema: myResultsSchema })).items,
);

export const getVerificationSettings = cache(() =>
  apiFetch("/attendance-verification/settings", { schema: verificationSettingsSchema }),
);

export const listVerifications = cache(async (filters: VerificationFilters) => {
  const params = new URLSearchParams({ page: String(filters.page), pageSize: "20" });
  if (filters.flagged) params.set("flagged", "true");
  return apiFetch(`/attendance-verification?${params.toString()}`, {
    schema: verificationListSchema,
  });
});

export const listWorkLocationRequests = cache(
  async () =>
    (
      await apiFetch("/attendance-verification/work-locations", {
        schema: workLocationRequestListSchema,
      })
    ).items,
);

export const listPhotoRequests = cache(
  async () =>
    (
      await apiFetch("/attendance-verification/photo-requests", {
        schema: photoRequestListSchema,
      })
    ).items,
);
