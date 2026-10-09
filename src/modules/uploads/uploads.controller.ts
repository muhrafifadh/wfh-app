import {
  Body,
  Controller,
  Delete,
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
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";

import { ZodResponse } from "nestjs-zod";

import { Authenticated } from "@/common/decorators/authenticated.decorator.js";
import { CurrentUser } from "@/common/decorators/current-user.decorator.js";
import { ErrorResponse } from "@/common/dto/error.response.js";
import type { AuthUser } from "@/common/types/auth.js";
import { CreateUploadDto } from "@/modules/uploads/dto/create-upload.dto.js";
import { ListUploadsQuery } from "@/modules/uploads/dto/list-uploads.query.js";
import {
  CreateUploadResponse,
  UploadListResponse,
  UploadResponse,
} from "@/modules/uploads/dto/upload.response.js";
import { UploadsService } from "@/modules/uploads/uploads.service.js";

/**
 * Any signed-in user can upload; files are scoped to their organization.
 * Features that attach files (avatars, invoice PDFs) add their own permission checks.
 */
@ApiTags("uploads")
@ApiBearerAuth()
@Controller("uploads")
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  /** Completed uploads in the caller's organization, newest first. */
  @Get()
  @Authenticated()
  @ZodResponse({ status: 200, type: UploadListResponse })
  list(@CurrentUser() user: AuthUser, @Query() query: ListUploadsQuery) {
    return this.uploads.list(user, query);
  }

  @Post()
  @Authenticated()
  @ZodResponse({ status: 201, type: CreateUploadResponse })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateUploadDto) {
    return this.uploads.create(user, dto);
  }

  @Post(":id/complete")
  @Authenticated()
  @HttpCode(HttpStatus.OK)
  @ZodResponse({ status: 200, type: UploadResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: "NOT_FOUND" })
  @ApiConflictResponse({ type: ErrorResponse, description: "UPLOAD_NOT_RECEIVED" })
  @ApiUnprocessableEntityResponse({ type: ErrorResponse, description: "UPLOAD_MISMATCH" })
  complete(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.uploads.complete(user, id);
  }

  @Get(":id")
  @Authenticated()
  @ZodResponse({ status: 200, type: UploadResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: "NOT_FOUND" })
  findOne(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.uploads.findOne(user, id);
  }

  @Delete(":id")
  @Authenticated()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponse, description: "NOT_FOUND" })
  async remove(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.uploads.remove(user, id);
  }
}
