import type { AuditableEvent } from "@/common/events/auditable-event.js";

/**
 * The audit log records every attendance_verification.* event, and audit is kept for
 * years. So metadata holds neither coordinates nor results (decisions V3 and V8).
 */
export const VERIFICATION_EVENTS = {
  settingsChanged: "attendance_verification.settings_changed",
  noticeAcknowledged: "attendance_verification.notice_acknowledged",
  workLocationRequested: "attendance_verification.work_location_requested",
  workLocationApproved: "attendance_verification.work_location_approved",
  workLocationRejected: "attendance_verification.work_location_rejected",
  officeAdded: "attendance_verification.office_added",
  officeRemoved: "attendance_verification.office_removed",
  reviewed: "attendance_verification.reviewed",
  photoViewed: "attendance_verification.photo_viewed",
  photoRequested: "attendance_verification.photo_requested",
  photoDisclosed: "attendance_verification.photo_disclosed",
  photoRequestDeclined: "attendance_verification.photo_request_declined",
} as const;

export type VerificationEventName = (typeof VERIFICATION_EVENTS)[keyof typeof VERIFICATION_EVENTS];

export class VerificationEvent implements AuditableEvent {
  constructor(
    readonly name: VerificationEventName,
    readonly organizationId: string,
    readonly actorId: string | null,
    readonly targetType: string,
    readonly targetId: string,
    readonly metadata: Record<string, unknown> = {},
  ) {}
}
