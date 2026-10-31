import { NextResponse, type NextRequest } from "next/server";

import { getMeContext } from "@/features/profile/queries";
import { reportCsvPath } from "@/features/reports/queries";
import { reportRange } from "@/features/reports/range";
import { loadReportSearchParams } from "@/features/reports/search-params";
import { apiFetchStream } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { can, getSession } from "@/lib/auth/session";
import { reportError } from "@/lib/logger";

/**
 * UX_FLOWS.md §11.2 — the full filtered report as CSV (not just the page), streamed from
 * the backend, which audits the export. Same filters and range rules as /reports.
 */
export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  if (!can(user, "report:read_all")) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }
  const [filters, context] = await Promise.all([
    loadReportSearchParams(request.nextUrl.searchParams),
    getMeContext(),
  ]);
  const range = reportRange(filters, context.organization.workDate);
  if ("error" in range) {
    return NextResponse.json({ error: { code: "VALIDATION_FAILED" } }, { status: 400 });
  }

  try {
    const upstream = await apiFetchStream(reportCsvPath({ ...filters, ...range }));
    return new Response(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "text/csv; charset=utf-8",
        "Content-Disposition":
          upstream.headers.get("Content-Disposition") ??
          `attachment; filename="attendance-${range.from}-to-${range.to}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (!(error instanceof ApiError && error.status < 500)) reportError(error);
    const status = error instanceof ApiError ? error.status : 502;
    return NextResponse.json({ error: { code: "EXPORT_FAILED" } }, { status });
  }
}
