import { createHash, randomBytes } from "node:crypto";

/** 32 random bytes; returned to the client once and never stored. */
export const generateRefreshToken = (): string => randomBytes(32).toString("base64url");

/** What the database stores instead of the token itself. */
export const hashRefreshToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");
