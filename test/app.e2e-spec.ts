import { Body, Controller, Get, Post } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createZodDto } from "nestjs-zod";
import request from "supertest";
import { z } from "zod";

import { Public } from "@/common/decorators/public.decorator.js";
import { NotFoundError } from "@/common/errors/app-error.js";

import { createTestApp } from "./helpers.js";

// A throwaway controller that exercises the global pipeline.
class EchoDto extends createZodDto(z.strictObject({ amount: z.int().positive() })) {}

@Public()
@Controller("echo")
class EchoController {
  @Post()
  echo(@Body() dto: EchoDto) {
    return dto;
  }

  @Get("missing")
  missing() {
    throw new NotFoundError("Echo");
  }
}

describe("App (e2e)", () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp([EchoController]);
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /health/live is up, outside /v1, with a request id", async () => {
    const res = await request(app.getHttpServer()).get("/health/live").expect(200);

    expect(res.body.status).toBe("ok");
    expect(res.headers["x-request-id"]).toBeTruthy();
  });

  it("GET /health/ready reports the database as up", async () => {
    const res = await request(app.getHttpServer()).get("/health/ready").expect(200);

    expect(res.body.info.database.status).toBe("up");
  });

  it("routes are served under /v1", async () => {
    await request(app.getHttpServer())
      .post("/v1/echo")
      .send({ amount: 5 })
      .expect(201, { amount: 5 });
  });

  it("returns the standard error body for validation failures", async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/echo")
      .set("x-request-id", "test-request-0001")
      .send({ amount: -1, extra: true })
      .expect(400);

    expect(res.body.error).toMatchObject({
      code: "VALIDATION_FAILED",
      requestId: "test-request-0001",
    });
    expect(res.body.error.details.fieldErrors.amount).toBeDefined();
  });

  it("maps AppError to its status and code", async () => {
    const res = await request(app.getHttpServer()).get("/v1/echo/missing").expect(404);

    expect(res.body.error).toMatchObject({
      code: "NOT_FOUND",
      message: "Echo not found.",
    });
  });

  it("returns NOT_FOUND for unknown routes", async () => {
    const res = await request(app.getHttpServer()).get("/v1/nope").expect(404);

    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("sets security headers", async () => {
    const res = await request(app.getHttpServer()).get("/health/live");

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });
});
