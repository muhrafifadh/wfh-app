import { StatusBadge } from "@/components/shared/status-badge";
import type { Correction } from "@/features/corrections/schemas";
import { formatDuration } from "@/lib/format";
import { formatTimeIn, timeZoneLabel } from "@/lib/time-zone";
import { cn } from "@/lib/utils";

const EMPTY = "—";

type ComparisonProps = Pick<Correction, "timezone" | "current" | "requested" | "outcome">;

/**
 * UX_FLOWS.md §9.4 — current vs proposed: times, and the status and duration the server
 * recalculated for each. Changed rows are marked in words, not just colour.
 */
export function CorrectionComparison({ timezone, current, requested, outcome }: ComparisonProps) {
  const time = (value: string | null) =>
    value ? formatTimeIn(value, timezone).slice(0, 5) : EMPTY;
  const duration = (minutes: number | null) => (minutes === null ? EMPTY : formatDuration(minutes));
  const rows: {
    label: string;
    current: React.ReactNode;
    proposed: React.ReactNode;
    changed: boolean;
  }[] = [
    {
      label: `Check-in (${timeZoneLabel(timezone)})`,
      current: time(current.checkInAt),
      proposed: time(requested.checkInAt),
      changed: current.checkInAt !== requested.checkInAt,
    },
    {
      label: `Check-out (${timeZoneLabel(timezone)})`,
      current: time(current.checkOutAt),
      proposed: time(requested.checkOutAt),
      changed: current.checkOutAt !== requested.checkOutAt,
    },
    {
      label: "Status",
      current: <StatusBadge status={outcome.current.status} />,
      proposed: <StatusBadge status={outcome.requested.status} />,
      changed: outcome.current.status !== outcome.requested.status,
    },
    {
      label: "Late by",
      current: outcome.current.lateMinutes ? `${outcome.current.lateMinutes} min` : EMPTY,
      proposed: outcome.requested.lateMinutes ? `${outcome.requested.lateMinutes} min` : EMPTY,
      changed: outcome.current.lateMinutes !== outcome.requested.lateMinutes,
    },
    {
      label: "Duration",
      current: duration(outcome.current.workedMinutes),
      proposed: duration(outcome.requested.workedMinutes),
      changed: outcome.current.workedMinutes !== outcome.requested.workedMinutes,
    },
  ];

  return (
    <table className="w-full text-left text-sm">
      <thead className="text-xs text-muted-foreground">
        <tr className="border-b">
          <th scope="col" className="py-2 font-medium">
            Field
          </th>
          <th scope="col" className="py-2 font-medium">
            Current
          </th>
          <th scope="col" className="py-2 font-medium">
            Proposed
          </th>
        </tr>
      </thead>
      <tbody className="tabular-nums">
        {rows.map((row) => (
          <tr key={row.label} className="border-b last:border-0">
            <th scope="row" className="py-2 pr-2 font-normal text-muted-foreground">
              {row.label}
            </th>
            <td className="py-2 pr-2">{row.current}</td>
            <td className={cn("py-2", row.changed && "font-semibold")}>
              {row.proposed}
              {row.changed && <span className="sr-only"> (changed)</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
