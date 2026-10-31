import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { PinoLogger } from "nestjs-pino";

import { SessionsRepository } from "@/modules/auth/sessions.repository.js";
import { USER_EVENTS, type UserEvent } from "@/modules/users/users.events.js";

/**
 * A deactivated user is signed out everywhere. Even if this listener didn't run,
 * they couldn't get in: authenticate() and refresh() reject disabled users.
 */
@Injectable()
export class SessionsListener {
  constructor(
    private readonly sessions: SessionsRepository,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SessionsListener.name);
  }

  @OnEvent(USER_EVENTS.deactivated)
  async onUserDeactivated(event: UserEvent): Promise<void> {
    try {
      await this.sessions.revokeAllForUser(event.targetId, new Date());
    } catch (error) {
      this.logger.error({ err: error, userId: event.targetId }, "Revoking sessions failed");
    }
  }
}
