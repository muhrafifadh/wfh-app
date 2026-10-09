// Same rules as the backend (backend src/modules/uploads/uploads.constants.ts).
// Checked here only to fail fast; the backend and the signed URL enforce them.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const FILE_TYPE_LABELS = {
  "image/png": "PNG image",
  "image/jpeg": "JPEG image",
  "image/webp": "WebP image",
  "image/gif": "GIF image",
  "application/pdf": "PDF",
  "text/plain": "Text",
  "text/csv": "CSV",
} as const;

export type FileType = keyof typeof FILE_TYPE_LABELS;
export const FILE_TYPES = Object.keys(FILE_TYPE_LABELS) as [FileType, ...FileType[]];

/** For the file picker's accept attribute. */
export const ACCEPT = FILE_TYPES.join(",");
