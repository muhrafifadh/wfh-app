/**
 * The backend calls happen server-to-server, so without this every user would
 * share the Next server's IP for rate limiting. Forward the client chain as-is:
 * the backend only trusts it from proxies listed in its TRUST_PROXY.
 *
 * In production, run Next behind a proxy that appends the real client IP
 * (Vercel, nginx, ALB). Next only fills in x-forwarded-for when it's missing.
 */
export function forwardedForHeader(value: string | null | undefined): Record<string, string> {
  return value ? { "X-Forwarded-For": value } : {};
}
