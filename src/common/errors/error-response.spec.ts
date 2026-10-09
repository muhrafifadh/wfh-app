import { NotFoundException } from "@nestjs/common";
import { ThrottlerException } from "@nestjs/throttler";

import { ZodValidationException } from "nestjs-zod";
import { z } from "zod";

import { ConflictError, NotFoundError } from "@/common/errors/app-error.js";
import { toErrorResponse } from "@/common/errors/error-response.js";

describe("toErrorResponse", () => {
  it("uses the status, code and details of an AppError", () => {
    const error = new ConflictError("Already exists.", "INVOICE_NUMBER_TAKEN", {
      field: "number",
    });

    expect(toErrorResponse(error)).toEqual({
      status: 409,
      body: {
        code: "INVOICE_NUMBER_TAKEN",
        message: "Already exists.",
        details: { field: "number" },
      },
    });
  });

  it("turns Zod validation failures into 400 with field errors", () => {
    const result = z
      .object({ amount: z.number().positive("Must be positive") })
      .safeParse({ amount: -1 });
    if (result.success) throw new Error("expected a validation failure");

    const { status, body } = toErrorResponse(new ZodValidationException(result.error));

    expect(status).toBe(400);
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(body.details).toEqual({
      fieldErrors: { amount: ["Must be positive"] },
    });
  });

  it("maps framework HTTP exceptions to a stable code", () => {
    expect(toErrorResponse(new NotFoundException()).body.code).toBe("NOT_FOUND");
    expect(toErrorResponse(new ThrottlerException()).status).toBe(429);
  });

  it("hides the details of unexpected errors", () => {
    expect(toErrorResponse(new Error("connection string: postgres://secret"))).toEqual({
      status: 500,
      body: { code: "INTERNAL_ERROR", message: "Something went wrong." },
    });
  });

  it("keeps the resource name in NotFoundError messages", () => {
    expect(toErrorResponse(new NotFoundError("Invoice")).body.message).toBe("Invoice not found.");
  });
});
