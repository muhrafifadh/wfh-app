import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
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
import { AttendanceVerificationService } from "@/modules/attendance-verification/attendance-verification.service.js";
import {
  ApproveWorkLocationDto,
  CreateSelfieUploadDto,
  DisclosePhotoDto,
  ListVerificationsQuery,
  RequestPhotoDto,
  RequestWorkLocationDto,
  SubmitLocationDto,
  UpdateVerificationSettingsDto,
} from "@/modules/attendance-verification/dto/verification.dto.js";
import {
  MyResultsResponse,
  MyVerificationResponse,
  PhotoRequestListResponse,
  PhotoRequestResponse,
  SelfieUploadResponse,
  SignedPhotoResponse,
  VerificationItemResponse,
  VerificationListResponse,
  VerificationSettingsResponse,
  WorkLocationRequestListResponse,
  WorkLocationRequestResponse,
} from "@/modules/attendance-verification/dto/verification.response.js";

const CAPTURE_ERRORS =
  "VERIFICATION_DISABLED, VERIFICATION_NOTICE_REQUIRED, ATTENDANCE_NOT_CHECKED_IN, VERIFICATION_ALREADY_RECORDED, VERIFICATION_WINDOW_CLOSED";

/** ATTENDANCE_VERIFICATION_PLAN.md — optional evidence at check-in. Off by default. */
@ApiTags("attendance-verification")
@ApiBearerAuth()
@ApiForbiddenResponse({ type: ErrorResponse, description: "FORBIDDEN" })
@Controller("attendance-verification")
export class AttendanceVerificationController {
  constructor(private readonly verification: AttendanceVerificationService) {}

  @Get("settings")
  @RequirePermissions("verification:manage")
  @ZodResponse({ status: 200, type: VerificationSettingsResponse })
  settings(@CurrentUser() user: AuthUser) {
    return this.verification.settings(user);
  }

  /** Turning a method on needs a recorded reason, and the deployment switch. Audited. */
  @Patch("settings")
  @RequirePermissions("verification:manage")
  @ZodResponse({ status: 200, type: VerificationSettingsResponse })
  @ApiConflictResponse({ type: ErrorResponse, description: "VERIFICATION_NOT_AVAILABLE" })
  @ApiUnprocessableEntityResponse({
    type: ErrorResponse,
    description: "VERIFICATION_JUSTIFICATION_REQUIRED",
  })
  updateSettings(@CurrentUser() user: AuthUser, @Body() dto: UpdateVerificationSettingsDto) {
    return this.verification.updateSettings(user, dto);
  }

  /** What the employee's card shows. With both methods off, nothing is shown or requested. */
  @Get("me")
  @RequirePermissions("attendance:self")
  @ZodResponse({ status: 200, type: MyVerificationResponse })
  mine(@CurrentUser() user: AuthUser) {
    return this.verification.mine(user);
  }

  /** The caller's results still within retention, newest first. */
  @Get("me/results")
  @RequirePermissions("attendance:self")
  @ZodResponse({ status: 200, type: MyResultsResponse })
  myResults(@CurrentUser() user: AuthUser) {
    return this.verification.myResults(user);
  }

  @Post("notice/acknowledge")
  @RequirePermissions("attendance:self")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async acknowledgeNotice(@CurrentUser() user: AuthUser): Promise<void> {
    await this.verification.acknowledgeNotice(user);
  }

  /** One reading after check-in, or a retry after low accuracy. Never stored; never blocks attendance. */
  @Post("location")
  @RequirePermissions("attendance:self")
  @HttpCode(HttpStatus.OK)
  @ZodResponse({ status: 200, type: MyVerificationResponse })
  @ApiConflictResponse({ type: ErrorResponse, description: CAPTURE_ERRORS })
  submitLocation(@CurrentUser() user: AuthUser, @Body() dto: SubmitLocationDto) {
    return this.verification.submitLocation(user, dto);
  }

  /** A URL to PUT the check-in photo to. Not the uploads module: these are never readable by colleagues. */
  @Post("selfie")
  @RequirePermissions("attendance:self")
  @ZodResponse({ status: 201, type: SelfieUploadResponse })
  @ApiConflictResponse({ type: ErrorResponse, description: CAPTURE_ERRORS })
  createSelfieUpload(@CurrentUser() user: AuthUser, @Body() dto: CreateSelfieUploadDto) {
    return this.verification.createSelfieUpload(user, dto);
  }

  @Post("selfie/complete")
  @RequirePermissions("attendance:self")
  @HttpCode(HttpStatus.OK)
  @ZodResponse({ status: 200, type: MyVerificationResponse })
  @ApiConflictResponse({
    type: ErrorResponse,
    description: `${CAPTURE_ERRORS}, UPLOAD_NOT_RECEIVED`,
  })
  @ApiUnprocessableEntityResponse({ type: ErrorResponse, description: "UPLOAD_MISMATCH" })
  completeSelfie(@CurrentUser() user: AuthUser) {
    return this.verification.completeSelfie(user);
  }

  /** Declares a work-from-home area. It becomes active only once Admin/HR approves it. */
  @Post("work-locations")
  @RequirePermissions("attendance:self")
  @ZodResponse({ status: 201, type: MyVerificationResponse })
  @ApiConflictResponse({
    type: ErrorResponse,
    description: "VERIFICATION_DISABLED, VERIFICATION_NOTICE_REQUIRED",
  })
  requestWorkLocation(@CurrentUser() user: AuthUser, @Body() dto: RequestWorkLocationDto) {
    return this.verification.requestWorkLocation(user, dto);
  }

  @Get("work-locations")
  @RequirePermissions("verification:manage")
  @ZodResponse({ status: 200, type: WorkLocationRequestListResponse })
  listWorkLocationRequests(@CurrentUser() user: AuthUser) {
    return this.verification.listWorkLocationRequests(user);
  }

  @Post("work-locations/:id/approve")
  @RequirePermissions("verification:manage")
  @HttpCode(HttpStatus.OK)
  @ZodResponse({ status: 200, type: WorkLocationRequestResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: "NOT_FOUND" })
  @ApiConflictResponse({ type: ErrorResponse, description: "WORK_LOCATION_ALREADY_DECIDED" })
  approveWorkLocation(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ApproveWorkLocationDto,
  ) {
    return this.verification.approveWorkLocation(user, id, dto);
  }

  @Post("work-locations/:id/reject")
  @RequirePermissions("verification:manage")
  @HttpCode(HttpStatus.OK)
  @ZodResponse({ status: 200, type: WorkLocationRequestResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: "NOT_FOUND" })
  @ApiConflictResponse({ type: ErrorResponse, description: "WORK_LOCATION_ALREADY_DECIDED" })
  rejectWorkLocation(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.verification.rejectWorkLocation(user, id);
  }

  /** An employee asks for their own photo; there is no in-app viewer for them (decision V12). */
  @Post("photo-requests")
  @RequirePermissions("attendance:self")
  @ZodResponse({ status: 201, type: PhotoRequestResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: "NOT_FOUND" })
  @ApiConflictResponse({ type: ErrorResponse, description: "PHOTO_NOT_AVAILABLE" })
  requestPhoto(@CurrentUser() user: AuthUser, @Body() dto: RequestPhotoDto) {
    return this.verification.requestPhoto(user, dto);
  }

  @Get("photo-requests")
  @RequirePermissions("verification:read_photo")
  @ZodResponse({ status: 200, type: PhotoRequestListResponse })
  listPhotoRequests(@CurrentUser() user: AuthUser) {
    return this.verification.listPhotoRequests(user);
  }

  /** Needs the identity check recorded. Audited. */
  @Post("photo-requests/:id/disclose")
  @RequirePermissions("verification:read_photo")
  @HttpCode(HttpStatus.OK)
  @ZodResponse({ status: 200, type: SignedPhotoResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: "NOT_FOUND" })
  @ApiConflictResponse({
    type: ErrorResponse,
    description: "PHOTO_NOT_AVAILABLE, PHOTO_REQUEST_ALREADY_DECIDED",
  })
  disclosePhoto(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: DisclosePhotoDto,
  ) {
    return this.verification.disclosePhoto(user, id, dto);
  }

  @Post("photo-requests/:id/decline")
  @RequirePermissions("verification:read_photo")
  @HttpCode(HttpStatus.OK)
  @ZodResponse({ status: 200, type: PhotoRequestResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: "NOT_FOUND" })
  @ApiConflictResponse({ type: ErrorResponse, description: "PHOTO_REQUEST_ALREADY_DECIDED" })
  declinePhotoRequest(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.verification.declinePhotoRequest(user, id);
  }

  /** Status and flags. Scope follows attendance:read_all or attendance:read_team, checked in the service. */
  @Get()
  @Authenticated()
  @ZodResponse({ status: 200, type: VerificationListResponse })
  list(@CurrentUser() user: AuthUser, @Query() query: ListVerificationsQuery) {
    return this.verification.list(user, query);
  }

  @Post(":id/review")
  @RequirePermissions("verification:manage")
  @HttpCode(HttpStatus.OK)
  @ZodResponse({ status: 200, type: VerificationItemResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: "NOT_FOUND" })
  review(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.verification.review(user, id);
  }

  /** A short-lived link to the photo. Authorized Admin/HR only; every call is audited (decision V9). */
  @Get(":id/photo")
  @RequirePermissions("verification:read_photo")
  @ZodResponse({ status: 200, type: SignedPhotoResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: "NOT_FOUND" })
  viewPhoto(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.verification.viewPhoto(user, id);
  }
}
