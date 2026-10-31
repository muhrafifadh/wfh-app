import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiForbiddenResponse, ApiTags } from "@nestjs/swagger";

import { ZodResponse } from "nestjs-zod";

import { CurrentUser } from "@/common/decorators/current-user.decorator.js";
import { RequirePermissions } from "@/common/decorators/require-permissions.decorator.js";
import { ErrorResponse } from "@/common/dto/error.response.js";
import type { AuthUser } from "@/common/types/auth.js";
import { WorkCalendarResponse } from "@/modules/holidays/dto/holiday.response.js";
import { WorkCalendarQuery } from "@/modules/holidays/dto/work-calendar.query.js";
import { HolidaysService } from "@/modules/holidays/holidays.service.js";

/** Working and non-working days for a date range, as attendance will see them. */
@ApiTags("holidays")
@ApiBearerAuth()
@Controller("work-calendar")
export class WorkCalendarController {
  constructor(private readonly holidays: HolidaysService) {}

  @Get()
  @RequirePermissions("holiday:manage")
  @ZodResponse({ status: 200, type: WorkCalendarResponse })
  @ApiForbiddenResponse({ type: ErrorResponse, description: "FORBIDDEN" })
  list(@CurrentUser() user: AuthUser, @Query() query: WorkCalendarQuery) {
    return this.holidays.calendar(user, query);
  }
}
