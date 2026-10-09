import "server-only";

import { z } from "zod";

import { ApiError } from "@/lib/api/errors";
import { getAccessToken } from "@/lib/auth/cookies";
import { env } from "@/lib/env";

// Backend error body (backend docs/05-api-design.md#errors)
const errorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
    requestId: z.string().optional(),
  }),
});

type ApiFetchOptions<S extends z.ZodType> = Omit<RequestInit, "body"> & {
  schema: S;
  body?: unknown;
  /** Send the access token from the session cookie. Default true. */
  auth?: boolean;
};

/**
 * docs/08-data-fetching.md — the only way to call the backend.
 * Parses success bodies with `schema` and throws ApiError for anything else.
 */
export async function apiFetch<S extends z.ZodType>(
  path: string,
  { schema, body, auth = true, headers, ...init }: ApiFetchOptions<S>,
): Promise<z.infer<S>> {
  const token = auth ? await getAccessToken() : undefined;

  const res = await fetch(`${env.API_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(body !== undefined && { "Content-Type": "application/json" }),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: init.signal ?? AbortSignal.timeout(10_000),
    cache: "no-store",
  });

  if (!res.ok) {
    const parsed = errorBodySchema.safeParse(await res.json().catch(() => null));
    if (parsed.success) {
      const { code, message, details, requestId } = parsed.data.error;
      throw new ApiError(res.status, code, message, details, requestId);
    }
    throw new ApiError(res.status, "UNKNOWN_ERROR", `API ${init.method ?? "GET"} ${path} failed`);
  }

  return schema.parse(res.status === 204 ? undefined : await res.json());
}
