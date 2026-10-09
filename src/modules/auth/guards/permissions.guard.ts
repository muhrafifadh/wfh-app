import { Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import type { Request } from "express";

import { PERMISSIONS_KEY } from "@/common/decorators/require-permissions.decorator.js";
import { ForbiddenError } from "@/common/errors/app-error.js";
import type { Permission } from "@/common/types/auth.js";

/** Global, runs after JwtAuthGuard. Enforces @RequirePermissions(...). */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(PERMISSIONS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required?.length) return true;

    const { user } = ctx.switchToHttp().getRequest<Request>();
    if (!user || !required.every((p) => user.permissions.includes(p))) throw new ForbiddenError();
    return true;
  }
}
