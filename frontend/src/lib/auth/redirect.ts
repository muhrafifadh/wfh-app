/**
 * Only same-site relative paths are allowed as post-login redirects.
 * Anything else ("//evil.com", "https://…", "/\\evil.com") falls back to "/".
 */
export function safeRedirectPath(next: unknown): string {
  if (typeof next !== "string") return "/";
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (/[\u0000-\u001f]/.test(next)) return "/";
  return next;
}
