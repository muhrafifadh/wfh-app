import "server-only";

import { headers as requestHeaders } from "next/headers";

import { type z } from "zod";

import { ApiError, errorBodySchema } from "@/lib/api/errors";
import { forwardedForHeader } from "@/lib/api/forwarded";
import { getAccessToken } from "@/lib/auth/cookies";
import { env } from "@/lib/env";

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
  const clientChain = (await requestHeaders()).get("x-forwarded-for");

  const res = await fetch(`${env.API_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(body !== undefined && { "Content-Type": "application/json" }),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...forwardedForHeader(clientChain),
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

  // 204, and 202 from fire-and-forget endpoints, have no body
  const text = await res.text();
  return schema.parse(text ? JSON.parse(text) : undefined);
}

/**
 * For downloads (e.g. a CSV export): the backend's response as it is, to stream on.
 * Errors still throw ApiError, like apiFetch.
 */
export async function apiFetchStream(path: string): Promise<Response> {
  const token = await getAccessToken();
  const clientChain = (await requestHeaders()).get("x-forwarded-for");
  const res = await fetch(`${env.API_URL}${path}`, {
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
      ...forwardedForHeader(clientChain),
    },
    // Exports can take longer than a page read
    signal: AbortSignal.timeout(60_000),
    cache: "no-store",
  });
  if (!res.ok) {
    const parsed = errorBodySchema.safeParse(await res.json().catch(() => null));
    if (parsed.success) {
      const { code, message, details, requestId } = parsed.data.error;
      throw new ApiError(res.status, code, message, details, requestId);
    }
    throw new ApiError(res.status, "UNKNOWN_ERROR", `API GET ${path} failed`);
  }
  return res;
}
