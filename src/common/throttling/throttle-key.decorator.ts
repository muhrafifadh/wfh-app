import { SetMetadata } from "@nestjs/common";

export const THROTTLE_KEY_FIELD = "throttleKeyField";

/**
 * Counts requests per client IP *and* this body field (case-insensitive),
 * e.g. @ThrottleKey("email") on login: one attacker can't lock out a victim
 * by failing their email from elsewhere, and one IP's budget is per account.
 */
export const ThrottleKey = (bodyField: string) => SetMetadata(THROTTLE_KEY_FIELD, bodyField);

/**
 * Throttler names (ThrottlerModule.forRoot). "perIp" only runs on @ThrottleKey
 * routes and ignores the body field, capping one client across many accounts
 * (credential stuffing). Tune both with @Throttle({ default: …, perIp: … }).
 */
export const THROTTLERS = { default: "default", perIp: "perIp" } as const;
