import { NextResponse } from "next/server";

import { getMyVerification } from "@/features/attendance-verification/queries";
import { ApiError } from "@/lib/api/errors";
import { can, getSession } from "@/lib/auth/session";
import { reportError } from "@/lib/logger";

/**
 * docs/08-data-fetching.md — the verification panel re-reads its state after a check-in.
 * Errors carry only their code and request ID.
 */
export async function GET() {
  const user = await getSession();
  if (!user) return errorResponse(401, "UNAUTHENTICATED");
  if (!can(user, "attendance:self")) return errorResponse(403, "FORBIDDEN");
  try {
    return NextResponse.json(await getMyVerification(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof ApiError && error.status < 500) {
      return errorResponse(error.status, error.code, error.requestId);
    }
    reportError(error);
    return errorResponse(
      502,
      "UPSTREAM_ERROR",
      error instanceof ApiError ? error.requestId : undefined,
    );
  }
}

const errorResponse = (status: number, code: string, requestId?: string) =>
  NextResponse.json({ error: { code, requestId: requestId ?? null } }, { status });
