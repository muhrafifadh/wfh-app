import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";

import { ZodResponse } from "nestjs-zod";

import { CurrentUser } from "@/common/decorators/current-user.decorator.js";
import { RequirePermissions } from "@/common/decorators/require-permissions.decorator.js";
import { ErrorResponse } from "@/common/dto/error.response.js";
import type { AuthUser } from "@/common/types/auth.js";
import { CreateWorkScheduleDto } from "@/modules/work-settings/dto/create-work-schedule.dto.js";
import { ListWorkSchedulesQuery } from "@/modules/work-settings/dto/list-work-schedules.query.js";
import {
  WorkScheduleListResponse,
  WorkSchedulePreviewResponse,
  WorkScheduleResponse,
} from "@/modules/work-settings/dto/work-schedule.response.js";
import { WorkSettingsService } from "@/modules/work-settings/work-settings.service.js";

/** Schedule versions. Versions are never edited: a new one replaces the current one. */
@ApiTags("work-settings")
@ApiBearerAuth()
@ApiForbiddenResponse({ type: ErrorResponse, description: "FORBIDDEN" })
@Controller("work-schedules")
export class WorkSchedulesController {
  constructor(private readonly settings: WorkSettingsService) {}

  @Get()
  @RequirePermissions("policy:manage")
  @ZodResponse({ status: 200, type: WorkScheduleListResponse })
  list(@CurrentUser() user: AuthUser, @Query() query: ListWorkSchedulesQuery) {
    return this.settings.listSchedules(user, query);
  }

  @Get(":id")
  @RequirePermissions("policy:manage")
  @ZodResponse({ status: 200, type: WorkScheduleResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: "NOT_FOUND" })
  findOne(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.settings.findSchedule(user, id);
  }

  /** Starts a new version on effectiveFrom (tomorrow at the earliest) and ends the current one. */
  @Post()
  @RequirePermissions("policy:manage")
  @ZodResponse({ status: 201, type: WorkScheduleResponse })
  @ApiConflictResponse({ type: ErrorResponse, description: "SCHEDULE_PERIOD_OVERLAP" })
  @ApiUnprocessableEntityResponse({
    type: ErrorResponse,
    description: "SCHEDULE_EFFECTIVE_DATE_TOO_EARLY",
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateWorkScheduleDto) {
    return this.settings.createSchedule(user, dto);
  }

  /** Validates a version and shows its boundaries for the first days, without saving it. */
  @Post("preview")
  @RequirePermissions("policy:manage")
  @HttpCode(HttpStatus.OK)
  @ZodResponse({ status: 200, type: WorkSchedulePreviewResponse })
  @ApiUnprocessableEntityResponse({
    type: ErrorResponse,
    description: "SCHEDULE_EFFECTIVE_DATE_TOO_EARLY",
  })
  preview(@CurrentUser() user: AuthUser, @Body() dto: CreateWorkScheduleDto) {
    return this.settings.previewSchedule(user, dto);
  }
}
