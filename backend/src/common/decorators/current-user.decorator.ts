import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

import type { Request } from "express";

import { UnauthenticatedError } from "@/common/errors/app-error.js";
import type { AuthUser } from "@/common/types/auth.js";

/** The authenticated caller. Never read req.user directly. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  const user = ctx.switchToHttp().getRequest<Request>().user;
  if (!user) throw new UnauthenticatedError();
  return user;
});
