import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import type { AuditableEvent } from "@/common/events/auditable-event.js";
import { AuditService } from "@/modules/audit/audit.service.js";

/**
 * Records domain events without the emitting modules knowing about auditing.
 * Emitters use emitAsync(), so the entry is written before the response is sent.
 * To audit another module, add a handler for its namespace (e.g. "invoice.*").
 */
@Injectable()
export class AuditListener {
  constructor(private readonly audit: AuditService) {}

  /** Every USER_EVENTS name (src/modules/users/users.events.ts). */
  @OnEvent("user.*")
  async onUserEvent(event: AuditableEvent): Promise<void> {
    await this.audit.record(event);
  }
}
