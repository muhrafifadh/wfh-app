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
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";

import { ZodResponse } from "nestjs-zod";

import { CurrentUser } from "@/common/decorators/current-user.decorator.js";
import { RequirePermissions } from "@/common/decorators/require-permissions.decorator.js";
import { ErrorResponse } from "@/common/dto/error.response.js";
import type { AuthUser } from "@/common/types/auth.js";
import { InviteUserDto } from "@/modules/users/dto/invite-user.dto.js";
import { ListUsersQuery } from "@/modules/users/dto/list-users.query.js";
import { UpdateUserDto } from "@/modules/users/dto/update-user.dto.js";
import { UserListResponse, UserResponse } from "@/modules/users/dto/user.response.js";
import { UsersService } from "@/modules/users/users.service.js";

@ApiTags("users")
@ApiBearerAuth()
@ApiForbiddenResponse({ type: ErrorResponse, description: "FORBIDDEN" })
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions("user:read")
  @ZodResponse({ status: 200, type: UserListResponse })
  list(@CurrentUser() user: AuthUser, @Query() query: ListUsersQuery) {
    return this.users.list(user, query);
  }

  @Get(":id")
  @RequirePermissions("user:read")
  @ZodResponse({ status: 200, type: UserResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: "NOT_FOUND" })
  findOne(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.users.findOne(user, id);
  }

  /** Creates the user without a password and emails them an invitation link. */
  @Post()
  @RequirePermissions("user:manage")
  @ZodResponse({ status: 201, type: UserResponse })
  @ApiConflictResponse({ type: ErrorResponse, description: "EMAIL_TAKEN" })
  @ApiNotFoundResponse({ type: ErrorResponse, description: "NOT_FOUND (role)" })
  invite(@CurrentUser() user: AuthUser, @Body() dto: InviteUserDto) {
    return this.users.invite(user, dto);
  }

  @Patch(":id")
  @RequirePermissions("user:manage")
  @ZodResponse({ status: 200, type: UserResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: "NOT_FOUND (user or role)" })
  @ApiUnprocessableEntityResponse({ type: ErrorResponse, description: "CANNOT_CHANGE_OWN_ACCOUNT" })
  update(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(user, id, dto);
  }

  @Post(":id/invitation")
  @RequirePermissions("user:manage")
  @HttpCode(HttpStatus.ACCEPTED)
  @ZodResponse({ status: 202, type: UserResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: "NOT_FOUND" })
  @ApiConflictResponse({ type: ErrorResponse, description: "USER_NOT_INVITED" })
  resendInvitation(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.users.resendInvitation(user, id);
  }

  /** Blocks sign-in and ends their sessions. Reversible with /reactivate. */
  @Post(":id/deactivate")
  @RequirePermissions("user:manage")
  @HttpCode(HttpStatus.OK)
  @ZodResponse({ status: 200, type: UserResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: "NOT_FOUND" })
  @ApiUnprocessableEntityResponse({ type: ErrorResponse, description: "CANNOT_CHANGE_OWN_ACCOUNT" })
  deactivate(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.users.deactivate(user, id);
  }

  @Post(":id/reactivate")
  @RequirePermissions("user:manage")
  @HttpCode(HttpStatus.OK)
  @ZodResponse({ status: 200, type: UserResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: "NOT_FOUND" })
  reactivate(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.users.reactivate(user, id);
  }
}
