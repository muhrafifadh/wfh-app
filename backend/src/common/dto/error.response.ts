import { createZodDto } from "nestjs-zod";
import { z } from "zod";

/** The body of every error response (docs/05-api-design.md#errors). */
export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
    requestId: z.string(),
  }),
});

export class ErrorResponse extends createZodDto(errorResponseSchema) {}
