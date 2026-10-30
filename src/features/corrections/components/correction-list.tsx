import Link from "next/link";

import { ListPagination } from "@/components/shared/list-pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { routes } from "@/config/routes";
import { changeSummary } from "@/features/corrections/format";
import type { CorrectionList as CorrectionListData } from "@/features/corrections/schemas";
import { formatDayDate } from "@/lib/format";
import { formatDateTimeIn } from "@/lib/time-zone";

/**
 * UX_FLOWS.md §9.2–9.3 — one card per request: work date, what changes, when it was
 * submitted, its status, and the decision once there is one.
 */
export function CorrectionList({
  result,
  hrefFor,
  showEmployee = false,
}: {
  result: CorrectionListData;
  hrefFor: (page: number) => string;
  /** Review lists name the employee; your own list doesn't need to. */
  showEmployee?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {result.items.map((correction) => (
          <li key={correction.id} className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={routes.correction(correction.id)}
                className="font-medium underline-offset-4 hover:underline"
              >
                {showEmployee ? `${correction.employee.fullName} · ` : ""}
                {formatDayDate(correction.workDate)}
              </Link>
              <StatusBadge status={correction.status} />
            </div>
            <p className="tabular-nums">{changeSummary(correction)}</p>
            <p className="text-muted-foreground">
              Submitted {formatDateTimeIn(correction.submittedAt, correction.timezone)}
              {showEmployee && ` · ${correction.employee.employeeNumber}`}
            </p>
            {correction.decision && (
              <p className="break-words text-muted-foreground">
                {correction.status === "approved" ? "Approved" : "Rejected"} by{" "}
                {correction.decision.decidedBy.name}
                {correction.decision.note && (
                  <>
                    : <span className="text-foreground">{correction.decision.note}</span>
                  </>
                )}
              </p>
            )}
          </li>
        ))}
      </ul>
      <ListPagination
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        hrefFor={hrefFor}
      />
    </div>
  );
}
