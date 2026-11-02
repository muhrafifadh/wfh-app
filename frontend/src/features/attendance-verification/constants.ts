/** Backend attendance-verification.constants.ts. */
export const NOTICE_VERSION = 3;
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export const MIN_JUSTIFICATION_LENGTH = 20;

export const VERIFICATION_RESULTS = [
  "verified",
  "outside_approved_area",
  "low_accuracy",
  "not_shared",
  "no_approved_area",
  "captured",
] as const;
export type VerificationResult = (typeof VERIFICATION_RESULTS)[number];

export const VERIFICATION_MOMENTS = ["check_in", "check_out"] as const;
export type VerificationMoment = (typeof VERIFICATION_MOMENTS)[number];

export const VERIFICATION_METHODS = ["location", "selfie"] as const;
export type VerificationMethod = (typeof VERIFICATION_METHODS)[number];

/**
 * Decisions V10 and V11: plain words, and only "Outside approved area" reads as something
 * to look at. Managers see these labels and nothing more technical.
 */
export const RESULT_LABELS: Record<VerificationResult, string> = {
  verified: "Verified",
  outside_approved_area: "Outside approved area",
  low_accuracy: "Couldn't confirm",
  not_shared: "Not shared",
  no_approved_area: "No approved area",
  captured: "Photo taken",
};

export const METHOD_LABELS: Record<VerificationMethod, string> = {
  location: "Location",
  selfie: "Photo",
};

export const MOMENT_LABELS: Record<VerificationMoment, string> = {
  check_in: "Check-in",
  check_out: "Check-out",
};

export const DISTANCE_BAND_LABELS: Record<string, string> = {
  within_1km: "Within 1 km",
  within_10km: "1–10 km",
  over_10km: "Over 10 km",
};
