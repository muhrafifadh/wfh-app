import { Injectable, type ExecutionContext } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

import type { Request } from "express";

import { THROTTLE_KEY_FIELD, THROTTLERS } from "@/common/throttling/throttle-key.decorator.js";

/**
 * ThrottlerGuard keyed by req.ip, which comes from X-Forwarded-For only when
 * the request arrives through a proxy listed in TRUST_PROXY. Routes marked with
 * @ThrottleKey(field) are also keyed by that body field, except by the "perIp"
 * throttler, which caps the client across all values of the field.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override generateKey(context: ExecutionContext, suffix: string, name: string): string {
    const field = this.reflector.getAllAndOverride<string | undefined>(THROTTLE_KEY_FIELD, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!field || name === THROTTLERS.perIp) return super.generateKey(context, suffix, name);

    // Guards run before validation, so the body is still untrusted input.
    const value: unknown = context.switchToHttp().getRequest<Request>().body?.[field];
    const extra = typeof value === "string" ? value.trim().toLowerCase().slice(0, 254) : "";
    return super.generateKey(context, `${suffix}:${extra}`, name);
  }
}
