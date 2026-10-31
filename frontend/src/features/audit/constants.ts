// The actions the backend records (backend src/modules/users/users.events.ts), with
// how to say them in the UI. Unknown actions still show, by their raw name.
export const AUDIT_ACTION_LABELS = {
  "user.invited": "Invited a user",
  "user.invitation_accepted": "Accepted an invitation",
  "user.updated": "Updated a user",
  "user.deactivated": "Deactivated a user",
  "user.reactivated": "Reactivated a user",
  "user.email_verified": "Verified their email",
  "user.signed_in": "Signed in",
  "user.sign_in_failed": "Failed to sign in",
  "user.signed_out_everywhere": "Signed out everywhere",
  "user.password_reset": "Reset their password",
} as const;

export type AuditAction = keyof typeof AUDIT_ACTION_LABELS;
export const AUDIT_ACTIONS = Object.keys(AUDIT_ACTION_LABELS) as [AuditAction, ...AuditAction[]];

export function auditActionLabel(action: string): string {
  const known = AUDIT_ACTIONS.find((a) => a === action);
  return known ? AUDIT_ACTION_LABELS[known] : action;
}
