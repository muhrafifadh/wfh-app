import { Controller, Get, Query, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";

import type { Response } from "express";
import { ZodResponse } from "nestjs-zod";

import { Authenticated } from "@/common/decorators/authenticated.decorator.js";
import { CurrentUser } from "@/common/decorators/current-user.decorator.js";
import { RequirePermissions } from "@/common/decorators/require-permissions.decorator.js";
import { ErrorResponse } from "@/common/dto/error.response.js";
import type { AuthUser } from "@/common/types/auth.js";
import {
  DashboardQuery,
  ReportExportQuery,
  ReportQuery,
  TeamDayQuery,
  TeamHistoryQuery,
  TrendsQuery,
} from "@/modules/reports/dto/report.query.js";
import {
  OrganizationDashboardResponse,
  ReportResponse,
  TeamDayResponse,
  TeamHistoryResponse,
  TrendsResponse,
} from "@/modules/reports/dto/report.response.js";
import { ReportsService } from "@/modules/reports/reports.service.js";

const REPORT_PERMISSIONS =
  "Needs report:read_team (active direct reports) or report:read_all (organization).";

@ApiTags("team")
@ApiBearerAuth()
@ApiForbiddenResponse({ type: ErrorResponse, description: "FORBIDDEN" })
@Controller("team/attendance")
export class TeamController {
  constructor(private readonly reports: ReportsService) {}

  /** Each active direct report's status on a day (default today, last 90 days). */
  @Get("today")
  @RequirePermissions("attendance:read_team")
  @ZodResponse({ status: 200, type: TeamDayResponse })
  @ApiUnprocessableEntityResponse({ type: ErrorResponse, description: "EMPLOYEE_PROFILE_REQUIRED" })
  today(@CurrentUser() user: AuthUser, @Query() query: TeamDayQuery) {
    return this.reports.teamDay(user, query);
  }

  /** Active direct reports' records, newest first (default and maximum: the last 90 days). */
  @Get()
  @RequirePermissions("attendance:read_team")
  @ZodResponse({ status: 200, type: TeamHistoryResponse })
  @ApiUnprocessableEntityResponse({ type: ErrorResponse, description: "EMPLOYEE_PROFILE_REQUIRED" })
  history(@CurrentUser() user: AuthUser, @Query() query: TeamHistoryQuery) {
    return this.reports.teamHistory(user, query);
  }
}

@ApiTags("dashboard")
@ApiBearerAuth()
@ApiForbiddenResponse({ type: ErrorResponse, description: "FORBIDDEN" })
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly reports: ReportsService) {}

  /** Today's organization counts, pending corrections and the 30-working-day trend. */
  @Get("organization")
  @RequirePermissions("attendance:read_all")
  @ZodResponse({ status: 200, type: OrganizationDashboardResponse })
  organization(@CurrentUser() user: AuthUser, @Query() query: DashboardQuery) {
    return this.reports.organizationDashboard(user, query);
  }
}

@ApiTags("reports")
@ApiBearerAuth()
@ApiForbiddenResponse({ type: ErrorResponse, description: "FORBIDDEN" })
@Controller("reports")
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /** Records for a range with a summary that reconciles with them. */
  @Get("attendance")
  @Authenticated()
  @ZodResponse({ status: 200, type: ReportResponse, description: REPORT_PERMISSIONS })
  attendance(@CurrentUser() user: AuthUser, @Query() query: ReportQuery) {
    return this.reports.report(user, query);
  }

  /** Daily present/late/absent/incomplete counts for every date in the range. */
  @Get("attendance/trends")
  @Authenticated()
  @ZodResponse({ status: 200, type: TrendsResponse, description: REPORT_PERMISSIONS })
  trends(@CurrentUser() user: AuthUser, @Query() query: TrendsQuery) {
    return this.reports.trends(user, query);
  }

  /** The full filtered report as CSV (UTF-8 with BOM). Audited. */
  @Get("attendance.csv")
  @RequirePermissions("report:read_all")
  @ApiProduces("text/csv")
  @ApiOkResponse({ description: "CSV file", schema: { type: "string" } })
  async exportCsv(
    @CurrentUser() user: AuthUser,
    @Query() query: ReportExportQuery,
    @Res() res: Response,
  ): Promise<void> {
    const chunks = this.reports.exportCsv(user, query);
    // The first chunk runs the checks, so errors still get the normal JSON response
    const first = await chunks.next();
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="attendance-${query.from}-to-${query.to}.csv"`,
    );
    res.setHeader("Cache-Control", "no-store");
    if (!first.done) res.write(first.value);
    for await (const chunk of chunks) res.write(chunk);
    res.end();
  }
}
