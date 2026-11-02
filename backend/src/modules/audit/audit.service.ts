import { Injectable } from "@nestjs/common";

import { ClsService } from "nestjs-cls";
import { PinoLogger } from "nestjs-pino";
import { z } from "zod";

import type { Paginated } from "@/common/dto/pagination.js";
import type { AuditableEvent } from "@/common/events/auditable-event.js";
import type { AuthUser } from "@/common/types/auth.js";
import { AuditRepository, type AuditRow } from "@/modules/audit/audit.repository.js";
import type { AuditLogResponseBody } from "@/modules/audit/dto/audit-log.response.js";
import type { ListAuditLogsQueryInput } from "@/modules/audit/dto/list-audit-logs.query.js";

/** Event metadata must be plain JSON to be stored; parsing checks that instead of a cast. */
const jsonObject = z.record(z.string(), z.json());

const toAuditLog = (row: AuditRow): AuditLogResponseBody => ({
  ...row,
  metadata:
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? row.metadata
      : {},
  createdAt: row.createdAt.toISOString(),
});

@Injectable()
export class AuditService {
  constructor(
    private readonly repo: AuditRepository,
    private readonly cls: ClsService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AuditService.name);
  }

  /**
   * Writes one entry. A failure is logged, never thrown: the action already
   * happened, and failing the request now would only hide that from the user.
   */
  async record(event: AuditableEvent, forwardedRequestId?: string | null): Promise<void> {
    try {
      await this.repo.insert({
        organizationId: event.organizationId,
        actorId: event.actorId,
        action: event.name,
        targetType: event.targetType,
        targetId: event.targetId,
        metadata: jsonObject.parse(event.metadata),
        // Set when the event came from an HTTP request; links the entry to its logs
        requestId:
          forwardedRequestId !== undefined
            ? forwardedRequestId
            : this.cls.isActive()
              ? (this.cls.getId() ?? null)
              : null,
      });
    } catch (error) {
      this.logger.error({ err: error, action: event.name }, "Writing audit log failed");
    }
  }

  async list(
    user: AuthUser,
    query: ListAuditLogsQueryInput,
  ): Promise<Paginated<AuditLogResponseBody>> {
    const { rows, total } = await this.repo.list(user.organizationId, query);
    return { items: rows.map(toAuditLog), page: query.page, pageSize: query.pageSize, total };
  }
}
