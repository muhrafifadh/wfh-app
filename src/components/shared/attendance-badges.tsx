import { HistoryIcon, PencilLineIcon } from "lucide-react";

import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import type { Attendance } from "@/lib/attendance/schemas";

/** Status, plus "Incomplete" for a missing check-out and the correction indicator. */
export function AttendanceBadges({
  record,
}: {
  record: Pick<Attendance, "status" | "incomplete" | "corrected" | "pendingCorrectionId">;
}) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      <StatusBadge status={record.status} />
      {record.incomplete && <StatusBadge status="incomplete" />}
      {record.pendingCorrectionId ? (
        <Badge variant="outline">
          <HistoryIcon aria-hidden data-icon="inline-start" />
          Correction pending
        </Badge>
      ) : (
        record.corrected && (
          <Badge variant="outline">
            <PencilLineIcon aria-hidden data-icon="inline-start" />
            Corrected
          </Badge>
        )
      )}
    </span>
  );
}
