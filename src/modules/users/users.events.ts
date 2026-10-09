import type { AuditableEvent } from "@/common/events/auditable-event.js";

/**
 * docs/15-background-jobs.md#in-process-events — every user.* event. Emitted by the
 * users and auth modules; the audit log records all of them, and auth revokes
 * sessions on user.deactivated.
 */
export const USER_EVENTS = {
  invited: "user.invited",
  updated: "user.updated",
  deactivated: "user.deactivated",
  reactivated: "user.reactivated",
  invitationAccepted: "user.invitation_accepted",
  emailVerified: "user.email_verified",
  signedIn: "user.signed_in",
  /** Wrong password (or disabled) for an existing account. Unknown emails aren't recorded. */
  signInFailed: "user.sign_in_failed",
  signedOutEverywhere: "user.signed_out_everywhere",
  passwordReset: "user.password_reset",
} as const;

export type UserEventName = (typeof USER_EVENTS)[keyof typeof USER_EVENTS];

export class UserEvent implements AuditableEvent {
  readonly targetType = "user";

  constructor(
    readonly name: UserEventName,
    readonly organizationId: string,
    readonly actorId: string | null,
    readonly targetId: string,
    readonly metadata: Record<string, unknown> = {},
  ) {}
}
