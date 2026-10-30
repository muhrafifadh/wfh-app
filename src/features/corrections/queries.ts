import "server-only";

import { cache } from "react";

import { OPTIONS_PAGE_SIZE } from "@/config/constants";
import { correctionListSchema } from "@/features/corrections/schemas";
import { apiFetch } from "@/lib/api/client";

// docs/08-data-fetching.md — the caller's own correction requests (backend /v1/correction-requests/me).

/** Every request for one attendance record, newest first: its correction history. */
export const listCorrectionsForRecord = cache(async (attendanceId: string) => {
  const params = new URLSearchParams({ attendanceId, pageSize: String(OPTIONS_PAGE_SIZE) });
  return (await apiFetch(`/correction-requests/me?${params}`, { schema: correctionListSchema }))
    .items;
});

/** How many of the caller's requests wait for a decision. */
export const countMyPendingCorrections = cache(async () => {
  const params = new URLSearchParams({ status: "pending", pageSize: "1" });
  return (await apiFetch(`/correction-requests/me?${params}`, { schema: correctionListSchema }))
    .total;
});
