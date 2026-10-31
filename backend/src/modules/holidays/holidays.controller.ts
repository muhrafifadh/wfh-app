import {
  Body,
  Controller,
  Delete,
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
} from "@nestjs/swagger";

import { ZodResponse } from "nestjs-zod";

import { CurrentUser } from "@/common/decorators/current-user.decorator.js";
import { RequirePermissions } from "@/common/decorators/require-permissions.decorator.js";
import { ErrorResponse } from "@/common/dto/error.response.js";
import type { AuthUser } from "@/common/types/auth.js";
import { CreateHolidayDto } from "@/modules/holidays/dto/create-holiday.dto.js";
import { HolidayListResponse, HolidayResponse } from "@/modules/holidays/dto/holiday.response.js";
import { ListHolidaysQuery } from "@/modules/holidays/dto/list-holidays.query.js";
import { UpdateHolidayDto } from "@/modules/holidays/dto/update-holiday.dto.js";
import { HolidaysService } from "@/modules/holidays/holidays.service.js";

@ApiTags("holidays")
@ApiBearerAuth()
@ApiForbiddenResponse({ type: ErrorResponse, description: "FORBIDDEN" })
@Controller("holidays")
export class HolidaysController {
  constructor(private readonly holidays: HolidaysService) {}

  @Get()
  @RequirePermissions("holiday:manage")
  @ZodResponse({ status: 200, type: HolidayListResponse })
  list(@CurrentUser() user: AuthUser, @Query() query: ListHolidaysQuery) {
    return this.holidays.list(user, query);
  }

  @Get(":id")
  @RequirePermissions("holiday:manage")
  @ZodResponse({ status: 200, type: HolidayResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: "NOT_FOUND" })
  findOne(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.holidays.findOne(user, id);
  }

  @Post()
  @RequirePermissions("holiday:manage")
  @ZodResponse({ status: 201, type: HolidayResponse })
  @ApiConflictResponse({ type: ErrorResponse, description: "HOLIDAY_DATE_CONFLICT" })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateHolidayDto) {
    return this.holidays.create(user, dto);
  }

  @Patch(":id")
  @RequirePermissions("holiday:manage")
  @ZodResponse({ status: 200, type: HolidayResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: "NOT_FOUND" })
  @ApiConflictResponse({ type: ErrorResponse, description: "HOLIDAY_DATE_CONFLICT" })
  update(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateHolidayDto,
  ) {
    return this.holidays.update(user, id, dto);
  }

  @Delete(":id")
  @RequirePermissions("holiday:manage")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponse, description: "NOT_FOUND" })
  async remove(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.holidays.remove(user, id);
  }
}
