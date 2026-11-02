"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { routes } from "@/config/routes";
import { requestWorkLocationAction } from "@/features/attendance-verification/actions";
import { readLocation } from "@/features/attendance-verification/components/geolocation";
import { NoticeDialog } from "@/features/attendance-verification/components/notice-dialog";
import { ResultBadge } from "@/features/attendance-verification/components/result-badge";
import {
  METHOD_LABELS,
  MOMENT_LABELS,
  VERIFICATION_MOMENTS,
} from "@/features/attendance-verification/constants";
import { verificationKeys } from "@/features/attendance-verification/query-keys";
import type { MyVerification } from "@/features/attendance-verification/schemas";

/**
 * ATTENDANCE_VERIFICATION_PLAN.md — inside today's card: what today's check-in and
 * check-out recorded, and the employee's approved area. The photo and location themselves
 * are taken by the Check in and Check out buttons.
 */
export function VerificationSection({ mine }: { mine: MyVerification }) {
  const queryClient = useQueryClient();
  const [noticeOpen, setNoticeOpen] = useState(false);
  const set = (next: MyVerification) => queryClient.setQueryData(verificationKeys.mine(), next);
  const recorded = VERIFICATION_MOMENTS.filter((moment) =>
    mine.results.some((row) => row.moment === moment),
  );

  return (
    <>
      <Separator />
      <section aria-labelledby="verification-heading" className="grid gap-3">
        <div className="grid gap-1">
          <h3 id="verification-heading" className="flex items-center gap-2 font-medium">
            <ShieldCheckIcon aria-hidden className="size-4" />
            Attendance checks
          </h3>
          <p className="text-sm text-muted-foreground">
            Needed each time you check in and check out.
          </p>
        </div>
        {!mine.notice.acknowledged ? (
          <div className="grid gap-3">
            <p className="text-sm">Read how these checks work before anything is collected.</p>
            <div>
              <Button variant="outline" onClick={() => setNoticeOpen(true)}>
                Read the notice
              </Button>
            </div>
          </div>
        ) : (
          <>
            {recorded.map((moment) => (
              <section
                key={moment}
                aria-label={MOMENT_LABELS[moment]}
                className="flex flex-wrap items-center gap-3"
              >
                <span className="text-sm font-medium">{MOMENT_LABELS[moment]}</span>
                {mine.results
                  .filter((row) => row.moment === moment)
                  .map((row) => (
                    <span key={row.method} className="flex items-center gap-1 text-sm">
                      {METHOD_LABELS[row.method]}: <ResultBadge result={row.result} />
                    </span>
                  ))}
              </section>
            ))}
            {mine.location.enabled && <AreaSection mine={mine} onSaved={set} />}
            <Link
              href={routes.myVerification()}
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              My attendance evidence
            </Link>
          </>
        )}
      </section>
      <NoticeDialog
        open={noticeOpen}
        onOpenChange={setNoticeOpen}
        location={mine.location.enabled}
        selfie={mine.selfie.enabled}
        onAcknowledged={() => undefined}
      />
    </>
  );
}

function AreaSection({
  mine,
  onSaved,
}: {
  mine: MyVerification;
  onSaved: (next: MyVerification) => void;
}) {
  const { approved, pending } = mine.workLocation;
  const [changing, setChanging] = useState(false);

  return (
    <section aria-label="Approved work area" className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        {approved
          ? `Approved area: ${approved.label}.`
          : "You don't have an approved work-from-home area yet."}{" "}
        {pending && `Waiting for Admin/HR to approve “${pending.label}”.`}
      </p>
      {changing || (!approved && !pending) ? (
        <WorkLocationForm
          onDone={(next) => {
            onSaved(next);
            setChanging(false);
          }}
        />
      ) : (
        <div>
          <Button variant="link" className="h-auto p-0" onClick={() => setChanging(true)}>
            {pending ? "Change my request" : "Request a change"}
          </Button>
        </div>
      )}
    </section>
  );
}

/** Decision V5: the employee declares the area; it's active only once Admin/HR approves it. */
function WorkLocationForm({ onDone }: { onDone: (next: MyVerification) => void }) {
  const [label, setLabel] = useState("Home");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const reading = await readLocation();
      if (!reading) {
        setError(
          "Your browser didn't share a location. Allow location for this site and try again.",
        );
        return;
      }
      const result = await requestWorkLocationAction({
        label,
        latitude: reading.latitude,
        longitude: reading.longitude,
      });
      if (!result.ok) return setError(result.fieldErrors?.label?.[0] ?? result.error);
      toast.success("Sent to Admin/HR for approval.");
      onDone(result.data);
    });

  return (
    <form
      className="grid gap-2 rounded-md border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Label htmlFor="work-location-label">Name for this location</Label>
      <Input
        id="work-location-label"
        value={label}
        maxLength={120}
        onChange={(event) => setLabel(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby="work-location-help"
      />
      <p id="work-location-help" className="text-xs text-muted-foreground">
        Stand where you usually work. We save this position rounded to about 100 m.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Sending…" : "Use my current location"}
        </Button>
      </div>
    </form>
  );
}
