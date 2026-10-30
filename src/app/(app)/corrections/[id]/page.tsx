import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ChevronLeftIcon } from "lucide-react";

import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { CorrectionComparison } from "@/features/corrections/components/correction-comparison";
import { DecisionPanel } from "@/features/corrections/components/decision-panel";
import { getCorrection } from "@/features/corrections/queries";
import { correctionIdSchema } from "@/features/corrections/schemas";
import { canAny, requireUser } from "@/lib/auth/session";
import { formatDayDate } from "@/lib/format";
import { formatDateTimeIn, timeZoneLabel } from "@/lib/time-zone";

export const metadata: Metadata = { title: "Correction request" };

// UX_FLOWS.md §9.4 — visible to the requester and reviewers in scope; 404 for anyone else.
export default async function CorrectionPage({ params }: PageProps<"/corrections/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  if (!correctionIdSchema.safeParse(id).success) notFound();
  const correction = await getCorrection(id);
  if (!correction) notFound();
  const own = correction.requestedBy.id === user.id;
  const reviewer = canAny(user, ["correction:decide_team", "correction:decide_all"]);
  const zone = correction.timezone;

  return (
    <>
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" className="w-fit" asChild>
          <Link href={own || !reviewer ? routes.corrections() : routes.correctionReview()}>
            <ChevronLeftIcon aria-hidden />
            {own || !reviewer ? "My corrections" : "Correction review"}
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {own ? "Your correction" : correction.employee.fullName} ·{" "}
            {formatDayDate(correction.workDate)}
          </h1>
          <StatusBadge status={correction.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {own ? "" : `${correction.employee.employeeNumber} · `}Submitted{" "}
          {formatDateTimeIn(correction.submittedAt, zone)} · Times in {timeZoneLabel(zone)}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Current and proposed</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <CorrectionComparison {...correction} />
            <p className="text-xs text-muted-foreground">
              &ldquo;Current&rdquo; is the record when the request was made. Status and duration are
              calculated by the server.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Reason</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm break-words whitespace-pre-line">{correction.reason}</p>
            <p className="text-xs text-muted-foreground">
              Requested by {correction.requestedBy.name}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Decision</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {correction.decision ? (
            <div className="flex flex-col gap-2 text-sm">
              <p>
                {correction.status === "approved" ? "Approved" : "Rejected"} by{" "}
                <span className="font-medium">{correction.decision.decidedBy.name}</span> on{" "}
                {formatDateTimeIn(correction.decision.decidedAt, zone)}.
              </p>
              {correction.decision.note && (
                <p className="break-words whitespace-pre-line">
                  <span className="text-muted-foreground">Note: </span>
                  {correction.decision.note}
                </p>
              )}
              {correction.status === "approved" && (
                <p className="text-muted-foreground">
                  The attendance record now shows the proposed times.
                </p>
              )}
            </div>
          ) : correction.canDecide ? (
            <DecisionPanel correction={correction} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {own
                ? "Waiting for a decision. Your attendance doesn't change until it's approved."
                : "Waiting for a decision."}
              {own && reviewer && " You can't decide your own request."}
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
