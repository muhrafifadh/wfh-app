import { z } from "zod";

// Backend error body (backend docs/05-api-design.md#errors), checked against
// the generated contract in src/lib/api/contract.ts
export const errorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
    requestId: z.string(),
  }),
});

/** A non-2xx response from the backend, carrying its standard error body. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get fieldErrors(): Record<string, string[] | undefined> | undefined {
    const value = this.details?.fieldErrors;
    return value && typeof value === "object"
      ? (value as Record<string, string[] | undefined>)
      : undefined;
  }
}
