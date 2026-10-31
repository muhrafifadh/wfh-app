/** 10 MB. Raise per use case; the signed URL enforces the declared size. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Allowed types and the extension used in the object key. Anything else is rejected. */
export const CONTENT_TYPE_EXTENSIONS = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "application/pdf": ".pdf",
  "text/plain": ".txt",
  "text/csv": ".csv",
} as const;

export const ALLOWED_CONTENT_TYPES = Object.keys(CONTENT_TYPE_EXTENSIONS) as [
  keyof typeof CONTENT_TYPE_EXTENSIONS,
  ...(keyof typeof CONTENT_TYPE_EXTENSIONS)[],
];

/** Pending uploads never completed after this are removed by the cleanup job. */
export const PENDING_UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;
/** Soft-deleted uploads keep their file this long, so a mistake can be undone. */
export const DELETED_UPLOAD_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
