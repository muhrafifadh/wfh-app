import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiForbiddenResponse, ApiTags } from "@nestjs/swagger";

import { ZodResponse } from "nestjs-zod";

import { CurrentUser } from "@/common/decorators/current-user.decorator.js";
import { RequirePermissions } from "@/common/decorators/require-permissions.decorator.js";
import { ErrorResponse } from "@/common/dto/error.response.js";
import type { AuthUser } from "@/common/types/auth.js";
import { AuditService } from "@/modules/audit/audit.service.js";
import { AuditLogListResponse } from "@/modules/audit/dto/audit-log.response.js";
import { ListAuditLogsQuery } from "@/modules/audit/dto/list-audit-logs.query.js";

@ApiTags("audit")
@ApiBearerAuth()
@Controller("audit-logs")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  /** Newest first. Only the caller's organization. */
  @Get()
  @RequirePermissions("audit:read")
  @ZodResponse({ status: 200, type: AuditLogListResponse })
  @ApiForbiddenResponse({ type: ErrorResponse, description: "FORBIDDEN" })
  list(@CurrentUser() user: AuthUser, @Query() query: ListAuditLogsQuery) {
    return this.audit.list(user, query);
  }
}
