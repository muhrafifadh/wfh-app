import { SetMetadata } from "@nestjs/common";

export const IS_AUTHENTICATED = "isAuthenticated";

/**
 * Any signed-in user may call this route; no specific permission needed.
 * Use for routes about the caller themselves (/auth/me, /auth/logout).
 */
export const Authenticated = () => SetMetadata(IS_AUTHENTICATED, true);
