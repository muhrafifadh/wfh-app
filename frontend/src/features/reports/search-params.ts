import {
  createLoader,
  createSerializer,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  type inferParserType,
} from "nuqs/server";

import { routes } from "@/config/routes";
import { REPORT_COMPLETIONS, TEAM_FILTERS } from "@/features/reports/constants";
import { ATTENDANCE_STATUSES } from "@/lib/attendance/schemas";

// docs/11-state-and-url-params.md — the team, dashboard and reports URLs.

/** /team: a day (empty: today) and a card filter. */
export const teamSearchParams = {
  date: parseAsString.withDefault(""),
  show: parseAsStringLiteral(TEAM_FILTERS),
};
export const loadTeamSearchParams = createLoader(teamSearchParams);
export type TeamFilters = inferParserType<typeof teamSearchParams>;
const serializeTeam = createSerializer(teamSearchParams);
export const teamHref = (filters: Partial<TeamFilters>) => serializeTeam(routes.team(), filters);

/** /team/:employeeId: pages of the last 90 days. */
export const teamMemberSearchParams = { page: parseAsInteger.withDefault(1) };
export const loadTeamMemberSearchParams = createLoader(teamMemberSearchParams);

/** /dashboard for Admin/HR: narrowed to a division or an employee. */
export const dashboardSearchParams = {
  divisionId: parseAsString,
  employeeId: parseAsString,
};
export const loadDashboardSearchParams = createLoader(dashboardSearchParams);
export type DashboardFilters = inferParserType<typeof dashboardSearchParams>;
const serializeDashboard = createSerializer(dashboardSearchParams);
export const dashboardHref = (filters: Partial<DashboardFilters>) =>
  serializeDashboard(routes.dashboard(), filters);

/** /reports: a required range (empty: this month) and optional filters. */
export const reportSearchParams = {
  from: parseAsString.withDefault(""),
  to: parseAsString.withDefault(""),
  employeeId: parseAsString,
  divisionId: parseAsString,
  status: parseAsStringLiteral(ATTENDANCE_STATUSES),
  completion: parseAsStringLiteral(REPORT_COMPLETIONS),
  page: parseAsInteger.withDefault(1),
};
export const loadReportSearchParams = createLoader(reportSearchParams);
export type ReportFilters = inferParserType<typeof reportSearchParams>;
const serializeReport = createSerializer(reportSearchParams);
export const reportHref = (filters: Partial<ReportFilters>) =>
  serializeReport(routes.reports(), filters);

/** The CSV export for these filters (the whole result: no page). */
export const reportCsvHref = (filters: Partial<ReportFilters>) =>
  serializeReport(routes.reportCsv(), { ...filters, page: null });
