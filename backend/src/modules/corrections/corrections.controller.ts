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

import { Authenticated } from "@/common/decorators/authenticated.decorator.js";
import { CurrentUser } from "@/common/decorators/current-user.decorator.js";
import { RequirePermissions } from "@/common/decorators/require-permissions.decorator.js";
import { ErrorResponse } from "@/common/dto/error.response.js";
import type { AuthUser } from "@/common/types/auth.js";
import { CorrectionsService } from "@/modules/corrections/corrections.service.js";
import {
  CorrectionListResponse,
  CorrectionPreviewResponse,
  CorrectionResponse,
} from "@/modules/corrections/dto/correction.response.js";
import {
  ApproveCorrectionDto,
  RejectCorrectionDto,
} from "@/modules/corrections/dto/decide-correction.dto.js";
import {
  ListCorrectionsQuery,
  ListMyCorrectionsQuery,
} from "@/modules/corrections/dto/list-corrections.query.js";
import {
  PreviewCorrectionDto,
  SubmitCorrectionDto,
} from "@/modules/corrections/dto/submit-correction.dto.js";

const DECIDE_PERMISSIONS =
  "Needs correction:decide_team (active direct reports) or correction:decide_all (organization).";

@ApiTags("corrections")
@ApiBearerAuth()
@ApiForbiddenResponse({ type: ErrorResponse, description: "FORBIDDEN" })
@Controller("correction-requests")
export class CorrectionsController {
  constructor(private readonly corrections: CorrectionsService) {}

  /** Asks to change one of your own attendance records (up to 7 days after the work date). */
  @Post()
  @RequirePermissions("correction:submit")
  @ZodResponse({ status: 201, type: CorrectionResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: "NOT_FOUND" })
  @ApiConflictResponse({ type: ErrorResponse, description: "CORRECTION_ALREADY_PENDING" })
  @ApiUnprocessableEntityResponse({
    type: ErrorResponse,
    description: "EMPLOYEE_PROFILE_REQUIRED, CORRECTION_WINDOW_CLOSED, CORRECTION_TIMES_INVALID",
  })
  submit(@CurrentUser() user: AuthUser, @Body() dto: SubmitCorrectionDto) {
    return this.corrections.submit(user, dto);
  }

  /** What a proposal would change (status, lateness, duration), without submitting it. */
  @Post("preview")
  @RequirePermissions("correction:submit")
  @HttpCode(HttpStatus.OK)
  @ZodResponse({ status: 200, type: CorrectionPreviewResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: "NOT_FOUND" })
  @ApiUnprocessableEntityResponse({
    type: ErrorResponse,
    description: "EMPLOYEE_PROFILE_REQUIRED, CORRECTION_WINDOW_CLOSED, CORRECTION_TIMES_INVALID",
  })
  preview(@CurrentUser() user: AuthUser, @Body() dto: PreviewCorrectionDto) {
    return this.corrections.preview(user, dto);
  }

  /** Your own requests, newest first. */
  @Get("me")
  @RequirePermissions("correction:submit")
  @ZodResponse({ status: 200, type: CorrectionListResponse })
  listMine(@CurrentUser() user: AuthUser, @Query() query: ListMyCorrectionsQuery) {
    return this.corrections.listMine(user, query);
  }

  /** The review queue (never your own requests). */
  @Get()
  @Authenticated()
  @ZodResponse({ status: 200, type: CorrectionListResponse, description: DECIDE_PERMISSIONS })
  listForReview(@CurrentUser() user: AuthUser, @Query() query: ListCorrectionsQuery) {
    return this.corrections.listForReview(user, query);
  }

  /** Visible to the requester and to reviewers in scope. */
  @Get(":id")
  @Authenticated()
  @ZodResponse({ status: 200, type: CorrectionResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: "NOT_FOUND" })
  findOne(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.corrections.findOne(user, id);
  }

  /** Applies the requested times and recalculates the record. The first decision wins. */
  @Post(":id/approve")
  @Authenticated()
  @HttpCode(HttpStatus.OK)
  @ZodResponse({ status: 200, type: CorrectionResponse, description: DECIDE_PERMISSIONS })
  @ApiForbiddenResponse({ type: ErrorResponse, description: "CORRECTION_SELF_APPROVAL_FORBIDDEN" })
  @ApiNotFoundResponse({ type: ErrorResponse, description: "NOT_FOUND" })
  @ApiConflictResponse({
    type: ErrorResponse,
    description: "CORRECTION_ALREADY_DECIDED, CORRECTION_VERSION_CONFLICT",
  })
  approve(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ApproveCorrectionDto,
  ) {
    return this.corrections.approve(user, id, dto);
  }

  /** Leaves the record unchanged. A note is required. */
  @Post(":id/reject")
  @Authenticated()
  @HttpCode(HttpStatus.OK)
  @ZodResponse({ status: 200, type: CorrectionResponse, description: DECIDE_PERMISSIONS })
  @ApiForbiddenResponse({ type: ErrorResponse, description: "CORRECTION_SELF_APPROVAL_FORBIDDEN" })
  @ApiNotFoundResponse({ type: ErrorResponse, description: "NOT_FOUND" })
  @ApiConflictResponse({ type: ErrorResponse, description: "CORRECTION_ALREADY_DECIDED" })
  reject(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RejectCorrectionDto,
  ) {
    return this.corrections.reject(user, id, dto);
  }
}
