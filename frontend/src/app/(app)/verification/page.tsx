import type { Metadata } from "next";
import Link from "next/link";

import { NoAccess } from "@/app/(app)/_components/no-access";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/shared/list-pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatLongDate } from "@/features/attendance/format";
import { ResultBadge } from "@/features/attendance-verification/components/result-badge";
import {
  MarkReviewedButton,
  ViewPhotoButton,
} from "@/features/attendance-verification/components/review-actions";
import { DISTANCE_BAND_LABELS, METHOD_LABELS } from "@/features/attendance-verification/constants";
import { listVerifications } from "@/features/attendance-verification/queries";
import {
  loadVerificationSearchParams,
  verificationHref,
} from "@/features/attendance-verification/search-params";
import { can, requireUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Check-in check results" };

/**
 * Decisions V4, V9, V11: managers see their reports' status and flags only; Admin/HR also
 * see accuracy diagnostics and, with photo access, the photo. Never coordinates.
 */
export default async function VerificationReviewPage({ searchParams }: PageProps<"/verification">) {
  const user = await requireUser();
  if (!can(user, "attendance:read_team") && !can(user, "attendance:read_all")) {
    return <NoAccess title="Check-in check results" />;
  }
  const filters = await loadVerificationSearchParams(searchParams);
  const list = await listVerifications(filters);
  const canReview = can(user, "verification:manage");
  const canSeePhotos = can(user, "verification:read_photo");

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Check-in check results</h1>
      <p className="max-w-prose text-sm text-muted-foreground">
        A flag means a person should look: it isn&apos;t a finding, and it never changes attendance.
        Location and photos can be faked or unavailable, so treat them as one piece of evidence.
      </p>
      <nav aria-label="Filter" className="flex gap-4 text-sm">
        {[
          { label: "Waiting for review", flagged: true },
          { label: "All results", flagged: false },
        ].map((tab) => (
          <Link
            key={tab.label}
            href={verificationHref({ flagged: tab.flagged })}
            aria-current={filters.flagged === tab.flagged ? "page" : undefined}
            className={cn(
              "underline-offset-4 hover:underline",
              filters.flagged === tab.flagged ? "font-medium" : "text-muted-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {list.items.length === 0 ? (
        <EmptyState
          title={filters.flagged ? "Nothing to review" : "No results"}
          description="Results are kept for 90 days."
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Check</TableHead>
                <TableHead>Result</TableHead>
                {canReview && <TableHead>Details</TableHead>}
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{formatLongDate(item.workDate)}</TableCell>
                  <TableCell>
                    {item.employee.fullName}{" "}
                    <span className="text-muted-foreground">({item.employee.employeeNumber})</span>
                  </TableCell>
                  <TableCell>{METHOD_LABELS[item.method]}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <ResultBadge result={item.result} />
                      {item.reviewedAt && (
                        <span className="text-xs text-muted-foreground">Reviewed</span>
                      )}
                    </div>
                  </TableCell>
                  {canReview && (
                    <TableCell className="text-sm text-muted-foreground">
                      {[
                        item.diagnostics?.accuracyMeters != null &&
                          `±${item.diagnostics.accuracyMeters} m`,
                        item.diagnostics?.distanceBand &&
                          DISTANCE_BAND_LABELS[item.diagnostics.distanceBand],
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {canSeePhotos && item.photoAvailable && (
                        <ViewPhotoButton id={item.id} employeeName={item.employee.fullName} />
                      )}
                      {canReview && item.flagged && <MarkReviewedButton id={item.id} />}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ListPagination
            page={list.page}
            pageSize={list.pageSize}
            total={list.total}
            hrefFor={(page) => verificationHref({ ...filters, page })}
          />
        </>
      )}
    </>
  );
}
