import "server-only";

import { cache } from "react";

import { PAGE_SIZE } from "@/config/constants";
import {
  organizationDashboardSchema,
  reportSchema,
  teamDaySchema,
  teamHistorySchema,
  trendsSchema,
} from "@/features/reports/schemas";
import type { DashboardFilters, ReportFilters } from "@/features/reports/search-params";
import { apiFetch } from "@/lib/api/client";

// docs/08-data-fetching.md — team, dashboard and report reads (backend reports module).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const setId = (params: URLSearchParams, key: string, value: string | null | undefined) => {
  if (value && UUID.test(value)) params.set(key, value);
};

/** Each active direct report's status on a day (empty: today). */
export const getTeamDay = cache(async (date: string) => {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  return apiFetch(`/team/attendance/today?${params}`, { schema: teamDaySchema });
});

/** One direct report's records over the last 90 days, newest first. */
export const listTeamMemberHistory = cache(async (employeeId: string, page: number) => {
  const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  setId(params, "employeeId", employeeId);
  return apiFetch(`/team/attendance?${params}`, { schema: teamHistorySchema });
});

/** Today's organization counts, pending corrections and the 30-working-day trend. */
export const getOrganizationDashboard = cache(async (filters: DashboardFilters) => {
  const params = new URLSearchParams();
  setId(params, "divisionId", filters.divisionId);
  setId(params, "employeeId", filters.employeeId);
  return apiFetch(`/dashboard/organization?${params}`, { schema: organizationDashboardSchema });
});

export type ReportQuery = Partial<
  Pick<ReportFilters, "employeeId" | "divisionId" | "status" | "completion">
> & { from: string; to: string; page?: number; pageSize?: number };

const reportParams = (query: ReportQuery) => {
  const params = new URLSearchParams({ from: query.from, to: query.to });
  setId(params, "employeeId", query.employeeId);
  setId(params, "divisionId", query.divisionId);
  if (query.status) params.set("status", query.status);
  if (query.completion) params.set("completion", query.completion);
  return params;
};

/** Records in scope (team or organization) with a summary that reconciles with them. */
export const getReport = cache(async (query: ReportQuery) => {
  const params = reportParams(query);
  params.set("page", String(query.page ?? 1));
  params.set("pageSize", String(query.pageSize ?? PAGE_SIZE));
  return apiFetch(`/reports/attendance?${params}`, { schema: reportSchema });
});

/** Daily counts for every date in the range. */
export const getTrends = cache(
  async (query: Pick<ReportQuery, "from" | "to" | "employeeId" | "divisionId">) => {
    const params = new URLSearchParams({ from: query.from, to: query.to });
    setId(params, "employeeId", query.employeeId);
    setId(params, "divisionId", query.divisionId);
    return apiFetch(`/reports/attendance/trends?${params}`, { schema: trendsSchema });
  },
);

/** The CSV export's backend path for these filters (streamed by app/api/reports). */
export const reportCsvPath = (query: ReportQuery) =>
  `/reports/attendance.csv?${reportParams(query)}`;
