import { NextResponse } from "next/server";

import { getUnreadCount, listMyNotifications } from "@/features/notifications/queries";
import { ApiError } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { reportError } from "@/lib/logger";

/** How many recent notifications the header bell shows. */
const BELL_ITEMS = 8;

/**
 * docs/08-data-fetching.md — the header bell polls this: the unread count and the
 * latest few notifications. Errors carry only their code and request ID.
 */
export async function GET() {
  const user = await getSession();
  if (!user) return errorResponse(401, "UNAUTHENTICATED");
  try {
    const [unread, list] = await Promise.all([
      getUnreadCount(),
      listMyNotifications({ page: 1, pageSize: BELL_ITEMS }),
    ]);
    return NextResponse.json(
      { unread, items: list.items },
      { headers: { "Cache-Control": "no-store" } },
    );
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
