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
  ApiNotFoundResponse,
  ApiTags,
} from "@nestjs/swagger";

import { ZodResponse } from "nestjs-zod";

import { CurrentUser } from "@/common/decorators/current-user.decorator.js";
import { RequirePermissions } from "@/common/decorators/require-permissions.decorator.js";
import { ErrorResponse } from "@/common/dto/error.response.js";
import type { AuthUser } from "@/common/types/auth.js";
import { DivisionsService } from "@/modules/divisions/divisions.service.js";
import { CreateDivisionDto } from "@/modules/divisions/dto/create-division.dto.js";
import {
  DivisionListResponse,
  DivisionResponse,
} from "@/modules/divisions/dto/division.response.js";
import { ListDivisionsQuery } from "@/modules/divisions/dto/list-divisions.query.js";
import { UpdateDivisionDto } from "@/modules/divisions/dto/update-division.dto.js";

@ApiTags("divisions")
@ApiBearerAuth()
@ApiForbiddenResponse({ type: ErrorResponse, description: "FORBIDDEN" })
@Controller("divisions")
export class DivisionsController {
  constructor(private readonly divisions: DivisionsService) {}

  @Get()
  @RequirePermissions("division:manage")
  @ZodResponse({ status: 200, type: DivisionListResponse })
  list(@CurrentUser() user: AuthUser, @Query() query: ListDivisionsQuery) {
    return this.divisions.list(user, query);
  }

  @Get(":id")
  @RequirePermissions("division:manage")
  @ZodResponse({ status: 200, type: DivisionResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: "NOT_FOUND" })
  findOne(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.divisions.findOne(user, id);
  }

  @Post()
  @RequirePermissions("division:manage")
  @ZodResponse({ status: 201, type: DivisionResponse })
  @ApiConflictResponse({
    type: ErrorResponse,
    description: "DIVISION_CODE_TAKEN, DIVISION_NAME_TAKEN",
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDivisionDto) {
    return this.divisions.create(user, dto);
  }

  @Patch(":id")
  @RequirePermissions("division:manage")
  @ZodResponse({ status: 200, type: DivisionResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: "NOT_FOUND" })
  @ApiConflictResponse({
    type: ErrorResponse,
    description: "DIVISION_CODE_TAKEN, DIVISION_NAME_TAKEN",
  })
  update(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateDivisionDto,
  ) {
    return this.divisions.update(user, id, dto);
  }

  /** No new employees can be assigned to it. Refused while active employees remain. */
  @Post(":id/deactivate")
  @RequirePermissions("division:manage")
  @HttpCode(HttpStatus.OK)
  @ZodResponse({ status: 200, type: DivisionResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: "NOT_FOUND" })
  @ApiConflictResponse({ type: ErrorResponse, description: "DIVISION_HAS_ACTIVE_EMPLOYEES" })
  deactivate(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.divisions.deactivate(user, id);
  }

  @Post(":id/reactivate")
  @RequirePermissions("division:manage")
  @HttpCode(HttpStatus.OK)
  @ZodResponse({ status: 200, type: DivisionResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: "NOT_FOUND" })
  reactivate(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.divisions.reactivate(user, id);
  }
}
