import type { TeamFilter } from "@/features/reports/constants";
import type { TeamDay, TeamDayItem } from "@/features/reports/schemas";

/** The team cards (UX_FLOWS.md §10), each with the summary count it shows. */
export const TEAM_CARDS: {
  filter: TeamFilter;
  label: string;
  count: (s: TeamDay["summary"]) => number;
}[] = [
  { filter: "present", label: "Present", count: (s) => s.present },
  { filter: "late", label: "Late", count: (s) => s.late },
  { filter: "not_checked_in", label: "Not checked in", count: (s) => s.notCheckedIn },
  { filter: "not_checked_out", label: "Not checked out", count: (s) => s.notCheckedOut },
  { filter: "absent", label: "Absent", count: (s) => s.absent },
];

/**
 * Whether a team member belongs under a card. The same rules as the server's summary
 * (backend reports.service.ts teamDay), so a card's number always equals its list.
 */
export function matchesTeamFilter(item: TeamDayItem, filter: TeamFilter | null): boolean {
  switch (filter) {
    case null:
      return true;
    case "present":
    case "late":
      return item.record?.status === filter;
    default:
      return item.state === filter;
  }
}
