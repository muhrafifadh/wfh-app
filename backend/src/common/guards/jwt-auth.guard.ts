import { Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import type { Request } from "express";

import { Authenticator } from "@/common/contracts/directory.js";
import { IS_PUBLIC } from "@/common/decorators/public.decorator.js";
import { UnauthenticatedError } from "@/common/errors/app-error.js";

const BEARER = /^Bearer ([\w-]+\.[\w-]+\.[\w-]+)$/;

/** Global. Every route requires a valid access token unless marked @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: Authenticator,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const token = BEARER.exec(req.get("authorization") ?? "")?.[1];
    if (!token) throw new UnauthenticatedError();

    req.user = await this.auth.authenticate(token);
    return true;
  }
}
