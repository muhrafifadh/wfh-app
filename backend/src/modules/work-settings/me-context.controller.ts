import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { ZodResponse } from "nestjs-zod";

import { Authenticated } from "@/common/decorators/authenticated.decorator.js";
import { CurrentUser } from "@/common/decorators/current-user.decorator.js";
import type { AuthUser } from "@/common/types/auth.js";
import { MeContextResponse } from "@/modules/work-settings/dto/me-context.response.js";
import { MeContextService } from "@/modules/work-settings/me-context.service.js";

/** Lives with work settings so the employee side never has to call the attendance side. */
@ApiTags("me")
@ApiBearerAuth()
@Controller("me")
export class MeContextController {
  constructor(private readonly context: MeContextService) {}

  @Get("context")
  @Authenticated()
  @ZodResponse({ status: 200, type: MeContextResponse })
  me(@CurrentUser() user: AuthUser) {
    return this.context.contextFor(user);
  }
}
