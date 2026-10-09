import { HttpException } from "@nestjs/common";
import { ThrottlerException } from "@nestjs/throttler";

import { ZodSerializationException, ZodValidationException } from "nestjs-zod";
import { z } from "zod";

import { AppError } from "@/common/errors/app-error.js";

export type ErrorBody = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

const HTTP_CODES: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  405: "METHOD_NOT_ALLOWED",
  409: "CONFLICT",
  413: "PAYLOAD_TOO_LARGE",
  415: "UNSUPPORTED_MEDIA_TYPE",
  422: "UNPROCESSABLE_ENTITY",
  429: "RATE_LIMITED",
};

const INTERNAL: { status: number; body: ErrorBody } = {
  status: 500,
  body: { code: "INTERNAL_ERROR", message: "Something went wrong." },
};

/** Maps any thrown value to the standard error body (docs/05-api-design.md#errors). */
export function toErrorResponse(exception: unknown): {
  status: number;
  body: ErrorBody;
} {
  if (exception instanceof AppError) {
    return {
      status: exception.status,
      body: {
        code: exception.code,
        message: exception.message,
        details: exception.details,
      },
    };
  }

  if (exception instanceof ZodValidationException) {
    const zodError = exception.getZodError();
    const fieldErrors =
      zodError instanceof z.ZodError ? z.flattenError(zodError).fieldErrors : undefined;
    return {
      status: 400,
      body: {
        code: "VALIDATION_FAILED",
        message: "Some fields are invalid.",
        details: { fieldErrors },
      },
    };
  }

  // A response failed its own schema: our bug, never the client's.
  if (exception instanceof ZodSerializationException) return INTERNAL;

  if (exception instanceof ThrottlerException) {
    return {
      status: 429,
      body: {
        code: "RATE_LIMITED",
        message: "Too many requests. Please slow down.",
      },
    };
  }

  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    if (status >= 500) return INTERNAL;
    return {
      status,
      body: {
        code: HTTP_CODES[status] ?? "BAD_REQUEST",
        message: exception.message,
      },
    };
  }

  return INTERNAL;
}
