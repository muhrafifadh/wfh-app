import { type z } from "zod";

/** A failed call to one of the app's own route handlers (app/api), with its error code. */
export class RouteError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly requestId: string | null,
  ) {
    super(`Request failed: ${code}`);
    this.name = "RouteError";
  }
}

/**
 * docs/08-data-fetching.md — how TanStack Query calls a route handler. Parses the body
 * with `schema`; anything else throws a RouteError.
 */
export async function fetchJson<S extends z.ZodType>(url: string, schema: S): Promise<z.infer<S>> {
  const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (body as { error?: { code?: unknown; requestId?: unknown } } | null)?.error;
    throw new RouteError(
      res.status,
      typeof error?.code === "string" ? error.code : "UNKNOWN_ERROR",
      typeof error?.requestId === "string" ? error.requestId : null,
    );
  }
  return schema.parse(body);
}
