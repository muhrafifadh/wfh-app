import { Body, Controller, Get, Patch } from "@nestjs/common";
import { ApiBearerAuth, ApiForbiddenResponse, ApiTags } from "@nestjs/swagger";

import { ZodResponse } from "nestjs-zod";

import { CurrentUser } from "@/common/decorators/current-user.decorator.js";
import { RequirePermissions } from "@/common/decorators/require-permissions.decorator.js";
import { ErrorResponse } from "@/common/dto/error.response.js";
import type { AuthUser } from "@/common/types/auth.js";
import { UpdateWorkSettingsDto } from "@/modules/work-settings/dto/update-work-settings.dto.js";
import { WorkSettingsResponse } from "@/modules/work-settings/dto/work-settings.response.js";
import { WorkSettingsService } from "@/modules/work-settings/work-settings.service.js";

/** Organization-wide attendance settings. The schedule itself is under /work-schedules. */
@ApiTags("work-settings")
@ApiBearerAuth()
@ApiForbiddenResponse({ type: ErrorResponse, description: "FORBIDDEN" })
@Controller("work-settings")
export class WorkSettingsController {
  constructor(private readonly settings: WorkSettingsService) {}

  @Get()
  @RequirePermissions("policy:manage")
  @ZodResponse({ status: 200, type: WorkSettingsResponse })
  get(@CurrentUser() user: AuthUser) {
    return this.settings.getSettings(user);
  }

  @Patch()
  @RequirePermissions("policy:manage")
  @ZodResponse({ status: 200, type: WorkSettingsResponse })
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateWorkSettingsDto) {
    return this.settings.updateSettings(user, dto);
  }
}
