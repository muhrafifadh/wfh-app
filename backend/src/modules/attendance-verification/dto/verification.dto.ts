import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { paginationQuerySchema } from "@/common/dto/pagination.js";
import {
  MAX_PHOTO_BYTES,
  MAX_RADIUS_METERS,
  MIN_RADIUS_METERS,
  PHOTO_CONTENT_TYPES,
  VERIFICATION_MOMENTS,
} from "@/modules/attendance-verification/attendance-verification.constants.js";

const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);

export const updateVerificationSettingsSchema = z.strictObject({
  locationEnabled: z.boolean(),
  selfieEnabled: z.boolean(),
  /** Decision V7: why a method is being turned on. Goes in the audit log, so no names. */
  justification: z.string().trim().max(1000).optional(),
});
export type UpdateVerificationSettingsInput = z.infer<typeof updateVerificationSettingsSchema>;
export class UpdateVerificationSettingsDto extends createZodDto(updateVerificationSettingsSchema) {}

/** The evidence a check-in or check-out carries. The photo is the one already uploaded for it. */
export const recordWithEvidenceSchema = z.strictObject({
  /** Read when the photo is taken, and discarded after the comparison (decision V3). */
  location: z
    .strictObject({ latitude, longitude, accuracyMeters: z.number().min(0).max(1_000_000) })
    .optional(),
});
export type RecordWithEvidenceInput = z.infer<typeof recordWithEvidenceSchema>;
export class RecordWithEvidenceDto extends createZodDto(recordWithEvidenceSchema) {}

export const createPhotoUploadSchema = z.strictObject({
  moment: z.enum(VERIFICATION_MOMENTS),
  contentType: z.enum(PHOTO_CONTENT_TYPES),
  size: z.int().min(1).max(MAX_PHOTO_BYTES),
});
export type CreatePhotoUploadInput = z.infer<typeof createPhotoUploadSchema>;
export class CreatePhotoUploadDto extends createZodDto(createPhotoUploadSchema) {}

export const requestWorkLocationSchema = z.strictObject({
  label: z.string().trim().min(1, "Name this location").max(120),
  latitude,
  longitude,
});
export type RequestWorkLocationInput = z.infer<typeof requestWorkLocationSchema>;
export class RequestWorkLocationDto extends createZodDto(requestWorkLocationSchema) {}

export const approveWorkLocationSchema = z.strictObject({
  radiusMeters: z.int().min(MIN_RADIUS_METERS).max(MAX_RADIUS_METERS).optional(),
});
export type ApproveWorkLocationInput = z.infer<typeof approveWorkLocationSchema>;
export class ApproveWorkLocationDto extends createZodDto(approveWorkLocationSchema) {}

export const listVerificationsQuerySchema = paginationQuerySchema.extend({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  /** Only results waiting for a person's review. */
  flagged: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});
export type ListVerificationsQueryInput = z.infer<typeof listVerificationsQuerySchema>;
export class ListVerificationsQuery extends createZodDto(listVerificationsQuerySchema) {}

export const requestPhotoSchema = z.strictObject({ verificationId: z.uuid() });
export type RequestPhotoInput = z.infer<typeof requestPhotoSchema>;
export class RequestPhotoDto extends createZodDto(requestPhotoSchema) {}

export const disclosePhotoSchema = z.strictObject({
  /** How the requester's identity was confirmed, e.g. "Met in person". No ID numbers. */
  identityCheck: z.string().trim().min(5, "Say how you confirmed their identity").max(200),
});
export type DisclosePhotoInput = z.infer<typeof disclosePhotoSchema>;
export class DisclosePhotoDto extends createZodDto(disclosePhotoSchema) {}
