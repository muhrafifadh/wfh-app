import "server-only";

import { cache } from "react";

import { PAGE_SIZE } from "@/config/constants";
import {
  attendanceListSchema,
  attendanceSchema,
  attendanceSummarySchema,
  todaySchema,
} from "@/features/attendance/schemas";
import { apiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

// docs/08-data-fetching.md — the caller's own attendance (backend /v1/attendance).

/** Today's card: state, boundaries, record and allowed actions, decided by the server. */
export const getToday = cache(() => apiFetch("/attendance/today", { schema: todaySchema }));

export type HistoryQuery = {
  from: string;
  to: string;
  status?: "present" | "late" | "absent" | "incomplete" | null;
  page?: number;
  pageSize?: number;
};

/** Own records in a range, newest first. "incomplete" is a completion, not a status. */
export const listMyAttendance = cache(async (query: HistoryQuery) => {
  const params = new URLSearchParams({
    from: query.from,
    to: query.to,
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? PAGE_SIZE),
  });
  if (query.status === "incomplete") params.set("incomplete", "true");
  else if (query.status) params.set("status", query.status);
  return apiFetch(`/attendance/me?${params}`, { schema: attendanceListSchema });
});

/** The most recent records, for the dashboard. */
export const listRecentAttendance = cache(async (count: number) => {
  const params = new URLSearchParams({ pageSize: String(count) });
  return (await apiFetch(`/attendance/me?${params}`, { schema: attendanceListSchema })).items;
});

/** Counts that reconcile with the history list for the same range. */
export const getAttendanceSummary = cache(async (from: string, to: string) => {
  const params = new URLSearchParams({ from, to });
  return apiFetch(`/attendance/me/summary?${params}`, { schema: attendanceSummarySchema });
});

/** One own record, or null (someone else's is "not found" too). */
export const getAttendance = cache(async (id: string) => {
  try {
    return await apiFetch(`/attendance/${encodeURIComponent(id)}`, { schema: attendanceSchema });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
});
