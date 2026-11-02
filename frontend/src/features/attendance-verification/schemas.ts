import { z } from "zod";

import {
  MAX_RADIUS_METERS,
  MIN_JUSTIFICATION_LENGTH,
  MIN_RADIUS_METERS,
  VERIFICATION_METHODS,
  VERIFICATION_MOMENTS,
  VERIFICATION_RESULTS,
} from "@/features/attendance-verification/constants";

// Backend dto/verification.response.ts and dto/verification.dto.ts.

const result = z.enum(VERIFICATION_RESULTS);
const method = z.enum(VERIFICATION_METHODS);
const moment = z.enum(VERIFICATION_MOMENTS);
const employee = z.object({ id: z.string(), employeeNumber: z.string(), fullName: z.string() });

export const verificationSettingsSchema = z.object({
  available: z.boolean(),
  locationEnabled: z.boolean(),
  selfieEnabled: z.boolean(),
});
export type VerificationSettings = z.infer<typeof verificationSettingsSchema>;

export const myVerificationSchema = z.object({
  location: z.object({ enabled: z.boolean() }),
  selfie: z.object({ enabled: z.boolean() }),
  results: z.array(z.object({ moment, method, result })),
  notice: z.object({ version: z.int(), acknowledged: z.boolean() }),
  workLocation: z.object({
    approved: z.object({ label: z.string(), radiusMeters: z.int() }).nullable(),
    pending: z.object({ label: z.string() }).nullable(),
  }),
  offices: z.array(z.object({ label: z.string() })),
});
export type MyVerification = z.infer<typeof myVerificationSchema>;

export const myResultsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      workDate: z.string(),
      moment,
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
  moment,
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

export const officeSchema = z.object({
  id: z.string(),
  label: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  radiusMeters: z.int(),
});
export type Office = z.infer<typeof officeSchema>;
export const officeListSchema = z.object({ items: z.array(officeSchema) });

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

export const photoUploadSchema = z.object({
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

/** What a check-in or check-out carries. The photo is the one already uploaded for it. */
export const evidenceSchema = z.object({ location: locationReadingSchema.optional() }).strict();
export type Evidence = z.infer<typeof evidenceSchema>;

export const workLocationFormSchema = z
  .object({
    label: z.string().trim().min(1, "Name this location").max(120, "Use at most 120 characters"),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  })
  .strict();

export const officeFormSchema = z
  .object({
    label: z.string().trim().min(1, "Name this office").max(120, "Use at most 120 characters"),
    latitude: z
      .number("Enter a latitude")
      .min(-90, "Latitude is between -90 and 90")
      .max(90, "Latitude is between -90 and 90"),
    longitude: z
      .number("Enter a longitude")
      .min(-180, "Longitude is between -180 and 180")
      .max(180, "Longitude is between -180 and 180"),
    radiusMeters: z
      .int("Enter a whole number of metres")
      .min(MIN_RADIUS_METERS, `Use at least ${MIN_RADIUS_METERS} m`)
      .max(MAX_RADIUS_METERS, `Use at most ${MAX_RADIUS_METERS.toLocaleString("en")} m`),
  })
  .strict();

export const photoUploadInputSchema = z
  .object({
    moment,
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
