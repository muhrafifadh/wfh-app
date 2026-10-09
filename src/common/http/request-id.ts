import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";

const HEADER = "x-request-id";
const VALID_ID = /^[\w-]{8,128}$/;
const REQUEST_ID = Symbol("requestId");

type WithRequestId = IncomingMessage & { [REQUEST_ID]?: string };

/**
 * One ID per request, shared by the logger and CLS regardless of which
 * middleware runs first. Reuses a well-formed incoming x-request-id.
 */
export function resolveRequestId(req: IncomingMessage): string {
  const r = req as WithRequestId;
  if (!r[REQUEST_ID]) {
    const incoming = req.headers[HEADER];
    r[REQUEST_ID] =
      typeof incoming === "string" && VALID_ID.test(incoming) ? incoming : randomUUID();
  }
  return r[REQUEST_ID];
}

export const REQUEST_ID_HEADER = HEADER;
