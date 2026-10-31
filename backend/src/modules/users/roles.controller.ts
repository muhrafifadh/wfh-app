import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiForbiddenResponse, ApiTags } from "@nestjs/swagger";

import { ZodResponse } from "nestjs-zod";

import { CurrentUser } from "@/common/decorators/current-user.decorator.js";
import { RequirePermissions } from "@/common/decorators/require-permissions.decorator.js";
import { ErrorResponse } from "@/common/dto/error.response.js";
import type { AuthUser } from "@/common/types/auth.js";
import { RoleListResponse } from "@/modules/users/dto/role.response.js";
import { UsersService } from "@/modules/users/users.service.js";

/** The roles a user can be given (for the invite and edit forms). */
@ApiTags("users")
@ApiBearerAuth()
@Controller("roles")
export class RolesController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions("user:read")
  @ZodResponse({ status: 200, type: RoleListResponse })
  @ApiForbiddenResponse({ type: ErrorResponse, description: "FORBIDDEN" })
  list(@CurrentUser() user: AuthUser) {
    return this.users.listRoles(user);
  }
}
