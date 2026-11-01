import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { PinoLogger } from "nestjs-pino";

import {
  CORRECTION_EVENTS,
  type CorrectionEvent,
} from "@/modules/corrections/corrections.events.js";
import { NotificationsService } from "@/modules/notifications/notifications.service.js";

/**
 * DOMAIN_RULES.md §18 — corrections emit their events after the transaction commits;
 * this turns them into notifications. A failure here is logged and never fails the
 * request (docs/15-background-jobs.md#in-process-events).
 */
@Injectable()
export class NotificationsListener {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(NotificationsListener.name);
  }

  @OnEvent(CORRECTION_EVENTS.submitted)
  async onCorrectionSubmitted(event: CorrectionEvent): Promise<void> {
    await this.safely(event, () =>
      this.notifications.correctionSubmitted(event.organizationId, event.targetId),
    );
  }

  // One decorator per event: with wildcards on, an array would mean one dotted name
  @OnEvent(CORRECTION_EVENTS.approved)
  @OnEvent(CORRECTION_EVENTS.rejected)
  async onCorrectionDecided(event: CorrectionEvent): Promise<void> {
    await this.safely(event, () =>
      this.notifications.correctionDecided(event.organizationId, event.targetId),
    );
  }

  private async safely(event: CorrectionEvent, work: () => Promise<void>): Promise<void> {
    try {
      await work();
    } catch (error) {
      this.logger.error(
        { err: error, event: event.name, correctionId: event.targetId },
        "Creating notifications failed",
      );
    }
  }
}
