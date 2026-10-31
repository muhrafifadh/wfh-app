export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // sliding; extended on each refresh

/**
 * A refresh token presented again within this window after it was rotated is
 * treated as a concurrent refresh (e.g. two tabs or parallel requests), not theft.
 * It gets a fresh pair for the same session instead of revoking it.
 */
export const REFRESH_REUSE_GRACE_MS = 10_000;

export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;
