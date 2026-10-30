import "server-only";

import { cache } from "react";

import { OPTIONS_PAGE_SIZE, PAGE_SIZE } from "@/config/constants";
import { correctionListSchema, correctionSchema } from "@/features/corrections/schemas";
import type { MyCorrectionsFilters, ReviewFilters } from "@/features/corrections/search-params";
import { apiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

// docs/08-data-fetching.md — correction requests (backend /v1/correction-requests).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidOrNull = (value: string | null) => (value && UUID.test(value) ? value : null);

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

/** The caller's own requests, newest first. */
export const listMyCorrections = cache(async (filters: MyCorrectionsFilters) => {
  const params = new URLSearchParams({ page: String(filters.page), pageSize: String(PAGE_SIZE) });
  if (filters.status) params.set("status", filters.status);
  return apiFetch(`/correction-requests/me?${params}`, { schema: correctionListSchema });
});

/** Requests the caller may decide (never their own); pending ones oldest first. */
export const listReviewQueue = cache(
  async (
    filters: Pick<ReviewFilters, "status" | "employeeId" | "divisionId" | "page">,
    pageSize = PAGE_SIZE,
  ) => {
    const params = new URLSearchParams({
      status: filters.status,
      page: String(filters.page),
      pageSize: String(pageSize),
    });
    const employeeId = uuidOrNull(filters.employeeId);
    const divisionId = uuidOrNull(filters.divisionId);
    if (employeeId) params.set("employeeId", employeeId);
    if (divisionId) params.set("divisionId", divisionId);
    return apiFetch(`/correction-requests?${params}`, { schema: correctionListSchema });
  },
);

/** One request the caller may see (own, or in review scope), or null. */
export const getCorrection = cache(async (id: string) => {
  try {
    return await apiFetch(`/correction-requests/${encodeURIComponent(id)}`, {
      schema: correctionSchema,
    });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
});
