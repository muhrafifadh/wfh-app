import { z } from "zod";

import {
  MIN_JUSTIFICATION_LENGTH,
  VERIFICATION_METHODS,
  VERIFICATION_RESULTS,
} from "@/features/attendance-verification/constants";

// Backend dto/verification.response.ts and dto/verification.dto.ts.

const result = z.enum(VERIFICATION_RESULTS);
const method = z.enum(VERIFICATION_METHODS);
const employee = z.object({ id: z.string(), employeeNumber: z.string(), fullName: z.string() });

export const verificationSettingsSchema = z.object({
  available: z.boolean(),
  locationEnabled: z.boolean(),
  selfieEnabled: z.boolean(),
});
export type VerificationSettings = z.infer<typeof verificationSettingsSchema>;

export const myVerificationSchema = z.object({
  location: z.object({ enabled: z.boolean(), result: result.nullable(), canSubmit: z.boolean() }),
  selfie: z.object({ enabled: z.boolean(), result: result.nullable(), canSubmit: z.boolean() }),
  notice: z.object({ version: z.int(), acknowledged: z.boolean() }),
  workLocation: z.object({
    approved: z.object({ label: z.string(), radiusMeters: z.int() }).nullable(),
    pending: z.object({ label: z.string() }).nullable(),
  }),
});
export type MyVerification = z.infer<typeof myVerificationSchema>;

export const myResultsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      workDate: z.string(),
      method,
      result,
      photoAvailable: z.boolean(),
      photoRequest: z.enum(["open", "disclosed", "declined"]).nullable(),
    }),
  ),
});
export type MyResult = z.infer<typeof myResultsSchema>["items"][number];

export const verificationItemSchema = z.object({
  id: z.string(),
  attendanceId: z.string(),
  workDate: z.string(),
  method,
  result,
  flagged: z.boolean(),
  reviewedAt: z.string().nullable(),
  employee,
  diagnostics: z
    .object({ accuracyMeters: z.int().nullable(), distanceBand: z.string().nullable() })
    .nullable(),
  photoAvailable: z.boolean().nullable(),
});
export type VerificationItem = z.infer<typeof verificationItemSchema>;
export const verificationListSchema = z.object({
  items: z.array(verificationItemSchema),
  page: z.int(),
  pageSize: z.int(),
  total: z.int(),
});

export const workLocationRequestSchema = z.object({
  id: z.string(),
  label: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  radiusMeters: z.int(),
  status: z.enum(["pending", "approved", "rejected", "superseded"]),
  requestedAt: z.string(),
  employee,
});
export type WorkLocationRequest = z.infer<typeof workLocationRequestSchema>;
export const workLocationRequestListSchema = z.object({
  items: z.array(workLocationRequestSchema),
});

export const photoRequestSchema = z.object({
  id: z.string(),
  verificationId: z.string().nullable(),
  workDate: z.string(),
  status: z.enum(["open", "disclosed", "declined"]),
  requestedAt: z.string(),
  employee,
});
export type PhotoRequest = z.infer<typeof photoRequestSchema>;
export const photoRequestListSchema = z.object({ items: z.array(photoRequestSchema) });

export const selfieUploadSchema = z.object({
  uploadUrl: z.url(),
  uploadHeaders: z.record(z.string(), z.string()),
  expiresAt: z.string(),
});
export const signedPhotoSchema = z.object({ url: z.url(), expiresAt: z.string() });
export type SignedPhoto = z.infer<typeof signedPhotoSchema>;

// Inputs

export const idSchema = z.uuid();

export const settingsFormSchema = z
  .object({
    locationEnabled: z.boolean(),
    selfieEnabled: z.boolean(),
    justification: z.string().trim().max(1000, "Use at most 1,000 characters"),
  })
  .strict();
export type SettingsForm = z.infer<typeof settingsFormSchema>;

/** Turning a method on needs a reason (decision V7); the form only knows the result. */
export const needsJustification = (
  before: Pick<VerificationSettings, "locationEnabled" | "selfieEnabled">,
  after: Pick<SettingsForm, "locationEnabled" | "selfieEnabled">,
) =>
  (after.locationEnabled && !before.locationEnabled) ||
  (after.selfieEnabled && !before.selfieEnabled);

export const justificationIsLongEnough = (value: string) =>
  value.trim().length >= MIN_JUSTIFICATION_LENGTH;

export const locationReadingSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracyMeters: z.number().min(0),
  })
  .strict();

export const workLocationFormSchema = z
  .object({
    label: z.string().trim().min(1, "Name this location").max(120, "Use at most 120 characters"),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  })
  .strict();

export const selfieUploadInputSchema = z
  .object({
    contentType: z.enum(["image/jpeg", "image/webp"]),
    size: z.int().min(1),
  })
  .strict();

export const discloseFormSchema = z
  .object({
    identityCheck: z
      .string()
      .trim()
      .min(5, "Say how you confirmed their identity")
      .max(200, "Use at most 200 characters"),
  })
  .strict();
