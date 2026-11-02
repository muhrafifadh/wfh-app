import type { ALLOWED_CONTENT_TYPES } from "@/modules/uploads/uploads.constants.js";

type AllowedType = (typeof ALLOWED_CONTENT_TYPES)[number];

/** How many leading bytes the check needs (text files are scanned for binary content). */
export const SIGNATURE_BYTES = 512;

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((byte, i) => bytes[offset + i] === byte);

const ascii = (text: string) => Array.from(Buffer.from(text, "latin1"));

/**
 * docs/13-security.md#files — the file's first bytes must match its declared type.
 * The Content-Type header is whatever the client said; the bytes are what it sent.
 */
export function matchesContentType(bytes: Uint8Array, contentType: AllowedType): boolean {
  switch (contentType) {
    case "image/png":
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/jpeg":
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case "image/gif":
      return startsWith(bytes, ascii("GIF87a")) || startsWith(bytes, ascii("GIF89a"));
    case "image/webp":
      return startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8);
    case "application/pdf":
      return startsWith(bytes, ascii("%PDF-"));
    case "text/plain":
    case "text/csv":
      // Text has no NUL bytes; executables, archives and images almost always do
      return !bytes.includes(0);
  }
}
