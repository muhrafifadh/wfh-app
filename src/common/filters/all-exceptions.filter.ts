import { Catch, type ArgumentsHost, type ExceptionFilter } from "@nestjs/common";

import type { Response } from "express";
import { ClsService } from "nestjs-cls";
import { PinoLogger } from "nestjs-pino";

import { toErrorResponse } from "@/common/errors/error-response.js";

/** The only exception filter. Every error leaves the API in the same shape. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    private readonly logger: PinoLogger,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(AllExceptionsFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const requestId = this.cls.getId();
    const { status, body } = toErrorResponse(exception);

    if (status >= 500) this.logger.error({ err: exception, requestId }, "Unhandled error");
    else if (status !== 404) this.logger.warn({ code: body.code, requestId }, body.message);

    res.status(status).json({ error: { ...body, requestId } });
  }
}
