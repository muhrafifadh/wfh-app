/**
 * docs/15-background-jobs.md#in-process-events — the shape every domain event has,
 * so the audit log can record any of them without knowing the module that emitted it.
 */
export type AuditableEvent = {
  /** "<entity>.<past-tense-verb>", e.g. "user.invited". */
  readonly name: string;
  readonly organizationId: string;
  /** Who did it, or null when no signed-in user was involved. */
  readonly actorId: string | null;
  readonly targetType: string | null;
  readonly targetId: string | null;
  /** Small, non-secret details. Never tokens or passwords. */
  readonly metadata: Record<string, unknown>;
};
