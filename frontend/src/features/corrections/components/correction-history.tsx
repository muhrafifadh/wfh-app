import { StatusBadge } from "@/components/shared/status-badge";
import type { Correction } from "@/features/corrections/schemas";
import { formatDateTimeIn, formatTimeIn, timeZoneLabel } from "@/lib/time-zone";

const EMPTY = "—";

/** UX_FLOWS.md §8.4 — a record's correction requests: original vs requested, and the decision. */
export function CorrectionHistory({
  corrections,
  timeZone,
}: {
  corrections: Correction[];
  timeZone: string;
}) {
  const time = (value: string | null) =>
    value ? `${formatTimeIn(value, timeZone).slice(0, 5)} ${timeZoneLabel(timeZone)}` : EMPTY;

  return (
    <ol className="flex flex-col gap-3">
      {corrections.map((correction) => (
        <li key={correction.id} className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={correction.status} />
            <span className="text-muted-foreground">
              Submitted {formatDateTimeIn(correction.submittedAt, timeZone)}
            </span>
          </div>
          <table className="w-full text-left">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="font-medium">
                  <span className="sr-only">Time</span>
                </th>
                <th scope="col" className="font-medium">
                  Original
                </th>
                <th scope="col" className="font-medium">
                  Requested
                </th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              <tr>
                <th scope="row" className="font-normal text-muted-foreground">
                  Check-in
                </th>
                <td>{time(correction.current.checkInAt)}</td>
                <td>{time(correction.requested.checkInAt)}</td>
              </tr>
              <tr>
                <th scope="row" className="font-normal text-muted-foreground">
                  Check-out
                </th>
                <td>{time(correction.current.checkOutAt)}</td>
                <td>{time(correction.requested.checkOutAt)}</td>
              </tr>
            </tbody>
          </table>
          <p className="break-words">
            <span className="text-muted-foreground">Reason: </span>
            {correction.reason}
          </p>
          {correction.decision && (
            <p className="break-words">
              <span className="text-muted-foreground">
                {correction.status === "approved" ? "Approved" : "Rejected"} by{" "}
                {correction.decision.decidedBy.name} on{" "}
                {formatDateTimeIn(correction.decision.decidedAt, timeZone)}
                {correction.decision.note ? ": " : ""}
              </span>
              {correction.decision.note}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
