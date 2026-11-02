/** ATTENDANCE_VERIFICATION_PIA.md §9 — bump when the notice changes, so employees see it again. */
export const NOTICE_VERSION = 1;

/** Accuracy worse than this can't confirm anything (decision V11). */
export const ACCURACY_THRESHOLD_METERS = 500;
export const DEFAULT_RADIUS_METERS = 1000;
export const MIN_RADIUS_METERS = 100;
export const MAX_RADIUS_METERS = 10_000;

/** Stored precision of a declared area: three decimals is about 100 m. */
export const WORK_LOCATION_DECIMALS = 3;

/** Evidence is captured at the moment of check-in, not later in the day (principle 1). */
export const CAPTURE_WINDOW_MS = 5 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;
/** Decision V3. */
export const PHOTO_RETENTION_MS = 30 * DAY_MS;
/** Decision V8. */
export const RESULT_RETENTION_MS = 90 * DAY_MS;
/** Rejected or replaced areas, and decided photo requests. */
export const CLOSED_ITEM_RETENTION_MS = 90 * DAY_MS;
/** Selfie uploads never completed after this are removed by the cleanup job. */
export const PENDING_PHOTO_TTL_MS = DAY_MS;

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export const PHOTO_CONTENT_TYPES = ["image/jpeg", "image/webp"] as const;
export const PHOTO_EXTENSIONS = { "image/jpeg": ".jpg", "image/webp": ".webp" } as const;

export const MIN_JUSTIFICATION_LENGTH = 20;
