import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";

import type { Response } from "express";
import { ZodResponse } from "nestjs-zod";

import { CurrentUser } from "@/common/decorators/current-user.decorator.js";
import { RequirePermissions } from "@/common/decorators/require-permissions.decorator.js";
import { ErrorResponse } from "@/common/dto/error.response.js";
import type { AuthUser } from "@/common/types/auth.js";
import { AttendanceService, type ActionResult } from "@/modules/attendance/attendance.service.js";
import {
  AttendanceListResponse,
  AttendanceResponse,
  AttendanceSummaryResponse,
  TodayResponse,
} from "@/modules/attendance/dto/attendance.response.js";
import { AttendanceActionDto } from "@/modules/attendance/dto/check-in.dto.js";
import {
  AttendanceSummaryQuery,
  ListMyAttendanceQuery,
} from "@/modules/attendance/dto/list-my-attendance.query.js";

const IDEMPOTENCY_HEADER = {
  name: "Idempotency-Key",
  required: true,
  description: "Unique per attempt (e.g. a UUID). Reuse it to retry the same attempt safely.",
} as const;

/** Lets the client tell a replayed result from a fresh one; the body is identical. */
const markReplay = (res: Response, result: ActionResult) => {
  if (result.replayed) res.setHeader("Idempotent-Replayed", "true");
  return result.body;
};

@ApiTags("attendance")
@ApiBearerAuth()
@ApiForbiddenResponse({ type: ErrorResponse, description: "FORBIDDEN" })
@Controller("attendance")
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  /** What the attendance card shows now: state, boundaries, record, allowed actions. */
  @Get("today")
  @RequirePermissions("attendance:self")
  @ZodResponse({ status: 200, type: TodayResponse })
  today(@CurrentUser() user: AuthUser) {
    return this.attendance.today(user);
  }

  /** Records a check-in at server time. The body must be empty. */
  @Post("check-in")
  @RequirePermissions("attendance:self")
  @ApiHeader(IDEMPOTENCY_HEADER)
  @ZodResponse({ status: 201, type: AttendanceResponse })
  @ApiBadRequestResponse({
    type: ErrorResponse,
    description: "IDEMPOTENCY_KEY_REQUIRED, VALIDATION_FAILED",
  })
  @ApiConflictResponse({
    type: ErrorResponse,
    description: "ATTENDANCE_ALREADY_CHECKED_IN, IDEMPOTENCY_KEY_REUSED",
  })
  @ApiUnprocessableEntityResponse({
    type: ErrorResponse,
    description:
      "EMPLOYEE_PROFILE_REQUIRED, EMPLOYEE_INACTIVE, ATTENDANCE_NOT_WORKDAY, CHECK_IN_TOO_EARLY, CHECK_IN_WINDOW_CLOSED",
  })
  async checkIn(
    @CurrentUser() user: AuthUser,
    @Headers("idempotency-key") key: string | undefined,
    @Body() _dto: AttendanceActionDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return markReplay(res, await this.attendance.checkIn(user, key));
  }

  /** Records today's check-out at server time. The body must be empty. */
  @Post("check-out")
  @RequirePermissions("attendance:self")
  @HttpCode(HttpStatus.OK)
  @ApiHeader(IDEMPOTENCY_HEADER)
  @ZodResponse({ status: 200, type: AttendanceResponse })
  @ApiBadRequestResponse({
    type: ErrorResponse,
    description: "IDEMPOTENCY_KEY_REQUIRED, VALIDATION_FAILED",
  })
  @ApiConflictResponse({
    type: ErrorResponse,
    description:
      "ATTENDANCE_NOT_CHECKED_IN, ATTENDANCE_ALREADY_CHECKED_OUT, IDEMPOTENCY_KEY_REUSED",
  })
  @ApiUnprocessableEntityResponse({
    type: ErrorResponse,
    description: "EMPLOYEE_PROFILE_REQUIRED, EMPLOYEE_INACTIVE, CHECK_OUT_WINDOW_CLOSED",
  })
  async checkOut(
    @CurrentUser() user: AuthUser,
    @Headers("idempotency-key") key: string | undefined,
    @Body() _dto: AttendanceActionDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return markReplay(res, await this.attendance.checkOut(user, key));
  }

  /** Own history, newest work date first. */
  @Get("me")
  @RequirePermissions("attendance:self")
  @ZodResponse({ status: 200, type: AttendanceListResponse })
  @ApiUnprocessableEntityResponse({ type: ErrorResponse, description: "EMPLOYEE_PROFILE_REQUIRED" })
  listMine(@CurrentUser() user: AuthUser, @Query() query: ListMyAttendanceQuery) {
    return this.attendance.listMine(user, query);
  }

  @Get("me/summary")
  @RequirePermissions("attendance:self")
  @ZodResponse({ status: 200, type: AttendanceSummaryResponse })
  @ApiUnprocessableEntityResponse({ type: ErrorResponse, description: "EMPLOYEE_PROFILE_REQUIRED" })
  summaryMine(@CurrentUser() user: AuthUser, @Query() query: AttendanceSummaryQuery) {
    return this.attendance.summaryMine(user, query);
  }

  @Get(":id")
  @RequirePermissions("attendance:self")
  @ZodResponse({ status: 200, type: AttendanceResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: "NOT_FOUND" })
  findOne(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.attendance.findOne(user, id);
  }
}
