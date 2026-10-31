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
import { CreateEmployeeDto } from "@/modules/employees/dto/create-employee.dto.js";
import {
  EmployeeListResponse,
  EmployeeResponse,
} from "@/modules/employees/dto/employee.response.js";
import { LinkAccountDto } from "@/modules/employees/dto/link-account.dto.js";
import { ListEmployeesQuery } from "@/modules/employees/dto/list-employees.query.js";
import { UpdateEmployeeDto } from "@/modules/employees/dto/update-employee.dto.js";
import { EmployeesService } from "@/modules/employees/employees.service.js";

@ApiTags("employees")
@ApiBearerAuth()
@ApiForbiddenResponse({ type: ErrorResponse, description: "FORBIDDEN" })
@Controller("employees")
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  @RequirePermissions("employee:manage")
  @ZodResponse({ status: 200, type: EmployeeListResponse })
  list(@CurrentUser() user: AuthUser, @Query() query: ListEmployeesQuery) {
    return this.employees.list(user, query);
  }

  @Get(":id")
  @RequirePermissions("employee:manage")
  @ZodResponse({ status: 200, type: EmployeeResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: "NOT_FOUND" })
  findOne(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.employees.findOne(user, id);
  }

  @Post()
  @RequirePermissions("employee:manage")
  @ZodResponse({ status: 201, type: EmployeeResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: "NOT_FOUND (division or manager)" })
  @ApiConflictResponse({ type: ErrorResponse, description: "EMPLOYEE_NUMBER_TAKEN" })
  @ApiUnprocessableEntityResponse({
    type: ErrorResponse,
    description: "DIVISION_INACTIVE, MANAGER_INACTIVE, EMPLOYMENT_PERIOD_INVALID",
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEmployeeDto) {
    return this.employees.create(user, dto);
  }

  @Patch(":id")
  @RequirePermissions("employee:manage")
  @ZodResponse({ status: 200, type: EmployeeResponse })
  @ApiNotFoundResponse({
    type: ErrorResponse,
    description: "NOT_FOUND (employee, division or manager)",
  })
  @ApiUnprocessableEntityResponse({
    type: ErrorResponse,
    description:
      "REPORTING_LINE_CYCLE, DIVISION_INACTIVE, MANAGER_INACTIVE, EMPLOYMENT_PERIOD_INVALID",
  })
  update(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employees.update(user, id, dto);
  }

  /** Ends attendance eligibility; history is kept. Reversible with /reactivate. */
  @Post(":id/deactivate")
  @RequirePermissions("employee:manage")
  @HttpCode(HttpStatus.OK)
  @ZodResponse({ status: 200, type: EmployeeResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: "NOT_FOUND" })
  deactivate(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.employees.deactivate(user, id);
  }

  @Post(":id/reactivate")
  @RequirePermissions("employee:manage")
  @HttpCode(HttpStatus.OK)
  @ZodResponse({ status: 200, type: EmployeeResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: "NOT_FOUND" })
  reactivate(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.employees.reactivate(user, id);
  }

  /** Invites a new user for the employee, or links an existing user (needs user:manage too). */
  @Post(":id/account")
  @RequirePermissions("employee:manage", "user:manage")
  @HttpCode(HttpStatus.OK)
  @ZodResponse({ status: 200, type: EmployeeResponse })
  @ApiNotFoundResponse({ type: ErrorResponse, description: "NOT_FOUND (employee, user or role)" })
  @ApiConflictResponse({
    type: ErrorResponse,
    description: "EMPLOYEE_HAS_ACCOUNT, USER_HAS_EMPLOYEE, EMAIL_TAKEN",
  })
  @ApiUnprocessableEntityResponse({ type: ErrorResponse, description: "CANNOT_CHANGE_OWN_ACCOUNT" })
  linkAccount(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: LinkAccountDto,
  ) {
    return this.employees.linkAccount(user, id, dto);
  }
}
