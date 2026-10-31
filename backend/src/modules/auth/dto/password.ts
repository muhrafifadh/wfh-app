import { z } from "zod";

/** docs/08-authentication.md: length matters, character rules don't. */
export const newPasswordSchema = z
  .string()
  .min(12, "Use at least 12 characters")
  .max(256, "Use at most 256 characters");

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email("Enter a valid email"));
