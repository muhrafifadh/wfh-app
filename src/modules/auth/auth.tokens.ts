import { createHash, randomBytes } from "node:crypto";

/** 32 random bytes for refresh and reset tokens. Returned once, never stored. */
export const generateToken = (): string => randomBytes(32).toString("base64url");

/** What the database stores instead of the token itself. */
export const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");
