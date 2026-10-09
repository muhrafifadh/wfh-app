/**
 * Parses TRUST_PROXY into an Express "trust proxy" value.
 *
 * - "" or "false": trust nobody; req.ip is the socket address.
 * - a number: trust that many hops in front of the app.
 * - a list ("loopback", "10.0.0.0/8", ...): trust only those addresses.
 *
 * "true" (trust every hop) is refused: any client could then pick its own IP
 * with X-Forwarded-For and dodge rate limits.
 */
export function parseTrustProxy(raw: string): false | number | string[] {
  const value = raw.trim();
  if (value === "" || value === "false") return false;
  if (value === "true") {
    throw new Error("TRUST_PROXY=true trusts any client. List the proxy addresses or a hop count.");
  }
  if (/^\d+$/.test(value)) return Number(value);
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}
