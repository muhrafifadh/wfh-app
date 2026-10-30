import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiTags, ApiUnprocessableEntityResponse } from "@nestjs/swagger";

import { ZodResponse } from "nestjs-zod";

import { Authenticated } from "@/common/decorators/authenticated.decorator.js";
import { CurrentUser } from "@/common/decorators/current-user.decorator.js";
import { ErrorResponse } from "@/common/dto/error.response.js";
import type { AuthUser } from "@/common/types/auth.js";
import { EmployeeResponse } from "@/modules/employees/dto/employee.response.js";
import { MeContextResponse } from "@/modules/employees/dto/me-context.response.js";
import { EmployeesService } from "@/modules/employees/employees.service.js";

/** The signed-in user's own records. Any signed-in user may read their own. */
@ApiTags("me")
@ApiBearerAuth()
@Controller("me")
export class MeController {
  constructor(private readonly employees: EmployeesService) {}

  @Get("employee")
  @Authenticated()
  @ZodResponse({ status: 200, type: EmployeeResponse })
  @ApiUnprocessableEntityResponse({ type: ErrorResponse, description: "EMPLOYEE_PROFILE_REQUIRED" })
  findMine(@CurrentUser() user: AuthUser) {
    return this.employees.findMine(user);
  }

  @Get("context")
  @Authenticated()
  @ZodResponse({ status: 200, type: MeContextResponse })
  context(@CurrentUser() user: AuthUser) {
    return this.employees.contextFor(user);
  }
}
