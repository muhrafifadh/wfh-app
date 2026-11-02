import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { paginated } from "@/common/dto/pagination.js";

const RESULTS = [
  "verified",
  "at_office",
  "outside_approved_area",
  "low_accuracy",
  "not_shared",
  "no_approved_area",
  "captured",
] as const;
const METHODS = ["location", "selfie"] as const;
const MOMENTS = ["check_in", "check_out"] as const;
const employee = z.object({ id: z.uuid(), employeeNumber: z.string(), fullName: z.string() });

export const verificationSettingsSchema = z.object({
  /** False when the deployment doesn't allow these checks; nothing can be turned on. */
  available: z.boolean(),
  locationEnabled: z.boolean(),
  selfieEnabled: z.boolean(),
});
export type VerificationSettingsBody = z.infer<typeof verificationSettingsSchema>;
export class VerificationSettingsResponse extends createZodDto(verificationSettingsSchema) {}

/** What the employee's card needs. Both methods off means nothing is shown or requested. */
export const myVerificationSchema = z.object({
  location: z.object({ enabled: z.boolean() }),
  selfie: z.object({ enabled: z.boolean() }),
  /** What today's check-in and check-out recorded. */
  results: z.array(
    z.object({ moment: z.enum(MOMENTS), method: z.enum(METHODS), result: z.enum(RESULTS) }),
  ),
  notice: z.object({ version: z.int(), acknowledged: z.boolean() }),
  workLocation: z.object({
    approved: z.object({ label: z.string(), radiusMeters: z.int() }).nullable(),
    pending: z.object({ label: z.string() }).nullable(),
  }),
  /** Names only: an employee has no need for the coordinates. */
  offices: z.array(z.object({ label: z.string() })),
});
export type MyVerificationBody = z.infer<typeof myVerificationSchema>;
export class MyVerificationResponse extends createZodDto(myVerificationSchema) {}

export const myResultSchema = z.object({
  id: z.uuid(),
  workDate: z.iso.date(),
  moment: z.enum(MOMENTS),
  method: z.enum(METHODS),
  result: z.enum(RESULTS),
  photoAvailable: z.boolean(),
  photoRequest: z.enum(["open", "disclosed", "declined"]).nullable(),
});
export type MyResultBody = z.infer<typeof myResultSchema>;
export const myResultsSchema = z.object({ items: z.array(myResultSchema) });
export class MyResultsResponse extends createZodDto(myResultsSchema) {}

/**
 * Decisions V9 and V11: managers get the status and flag only. `diagnostics` and
 * `photoAvailable` are null unless the caller is entitled to them.
 */
export const verificationItemSchema = z.object({
  id: z.uuid(),
  attendanceId: z.uuid(),
  workDate: z.iso.date(),
  moment: z.enum(MOMENTS),
  method: z.enum(METHODS),
  result: z.enum(RESULTS),
  flagged: z.boolean(),
  reviewedAt: z.iso.datetime().nullable(),
  employee,
  diagnostics: z
    .object({ accuracyMeters: z.int().nullable(), distanceBand: z.string().nullable() })
    .nullable(),
  photoAvailable: z.boolean().nullable(),
});
export type VerificationItemBody = z.infer<typeof verificationItemSchema>;
export class VerificationItemResponse extends createZodDto(verificationItemSchema) {}
export class VerificationListResponse extends createZodDto(paginated(verificationItemSchema)) {}

export const photoUploadSchema = z.object({
  /** PUT the photo here, with exactly these headers, then record the check-in or check-out. */
  uploadUrl: z.url(),
  uploadHeaders: z.record(z.string(), z.string()),
  expiresAt: z.iso.datetime(),
});
export type PhotoUploadBody = z.infer<typeof photoUploadSchema>;
export class PhotoUploadResponse extends createZodDto(photoUploadSchema) {}

export const signedPhotoSchema = z.object({ url: z.url(), expiresAt: z.iso.datetime() });
export type SignedPhotoBody = z.infer<typeof signedPhotoSchema>;
export class SignedPhotoResponse extends createZodDto(signedPhotoSchema) {}

export const workLocationRequestSchema = z.object({
  id: z.uuid(),
  label: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  radiusMeters: z.int(),
  status: z.enum(["pending", "approved", "rejected", "superseded"]),
  requestedAt: z.iso.datetime(),
  employee,
});
export type WorkLocationRequestBody = z.infer<typeof workLocationRequestSchema>;
export class WorkLocationRequestResponse extends createZodDto(workLocationRequestSchema) {}
export class WorkLocationRequestListResponse extends createZodDto(
  z.object({ items: z.array(workLocationRequestSchema) }),
) {}

export const officeSchema = z.object({
  id: z.uuid(),
  label: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  radiusMeters: z.int(),
});
export type OfficeBody = z.infer<typeof officeSchema>;
export class OfficeResponse extends createZodDto(officeSchema) {}
export class OfficeListResponse extends createZodDto(z.object({ items: z.array(officeSchema) })) {}

export const photoRequestSchema = z.object({
  id: z.uuid(),
  verificationId: z.uuid().nullable(),
  workDate: z.iso.date(),
  status: z.enum(["open", "disclosed", "declined"]),
  requestedAt: z.iso.datetime(),
  employee,
});
export type PhotoRequestBody = z.infer<typeof photoRequestSchema>;
export class PhotoRequestResponse extends createZodDto(photoRequestSchema) {}
export class PhotoRequestListResponse extends createZodDto(
  z.object({ items: z.array(photoRequestSchema) }),
) {}
