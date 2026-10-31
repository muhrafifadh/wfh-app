import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ChevronLeftIcon } from "lucide-react";

import { NoAccess } from "@/app/(app)/_components/no-access";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/shared/list-pagination";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { getMeContext } from "@/features/profile/queries";
import { RecordTable } from "@/features/reports/components/record-table";
import { TEAM_HISTORY_DAYS } from "@/features/reports/constants";
import { getTeamDay, listTeamMemberHistory } from "@/features/reports/queries";
import { loadTeamMemberSearchParams } from "@/features/reports/search-params";
import { can, requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Team member" };

// UX_FLOWS.md §10 — one direct report's last 90 days. Anyone else isn't on the team: 404.
export default async function TeamMemberPage({
  params,
  searchParams,
}: PageProps<"/team/[employeeId]">) {
  const user = await requireUser();
  if (!can(user, "attendance:read_team")) return <NoAccess title="Team member" />;
  const [{ employeeId }, { page }, context] = await Promise.all([
    params,
    loadTeamMemberSearchParams(searchParams),
    getMeContext(),
  ]);
  // The team list is the source of truth for who is a direct report
  const team = await getTeamDay("");
  const member = team.items.find((item) => item.employee.id === employeeId)?.employee;
  if (!member) notFound();
  const history = await listTeamMemberHistory(member.id, page);

  return (
    <>
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" className="w-fit" asChild>
          <Link href={routes.team()}>
            <ChevronLeftIcon aria-hidden />
            Team
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">{member.fullName}</h1>
        <p className="text-sm text-muted-foreground">
          {member.employeeNumber} · {member.division.name} · Last {TEAM_HISTORY_DAYS} days
        </p>
      </div>
      {history.total === 0 ? (
        <EmptyState title="No attendance records in the last 90 days" />
      ) : (
        <>
          <RecordTable
            records={history.items}
            timeZone={context.organization.timezone}
            showEmployee={false}
          />
          <ListPagination
            page={history.page}
            pageSize={history.pageSize}
            total={history.total}
            hrefFor={(next) => `${routes.teamMember(member.id)}?page=${next}`}
          />
        </>
      )}
    </>
  );
}
