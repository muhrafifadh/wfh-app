"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircleIcon, LogInIcon, LogOutIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { routes } from "@/config/routes";
import {
  checkInAction,
  checkOutAction,
  type AttendanceOutcome,
} from "@/features/attendance/actions";
import { OrgClock } from "@/features/attendance/components/org-clock";
import { TODAY_POLL_MS } from "@/features/attendance/constants";
import { formatClock, formatLongDate, scheduleLine } from "@/features/attendance/format";
import { attendanceKeys } from "@/features/attendance/query-keys";
import { todaySchema, type Today } from "@/features/attendance/schemas";
import { describeToday, nextBoundary } from "@/features/attendance/today-view";
import { CaptureDialog } from "@/features/attendance-verification/components/capture-dialog";
import { NoticeDialog } from "@/features/attendance-verification/components/notice-dialog";
import { VerificationSection } from "@/features/attendance-verification/components/verification-section";
import { verificationKeys } from "@/features/attendance-verification/query-keys";
import type { Evidence, MyVerification } from "@/features/attendance-verification/schemas";
import { useMyVerification } from "@/features/attendance-verification/use-my-verification";
import { fetchJson } from "@/lib/api/fetch-json";

type Kind = "check_in" | "check_out";

const WORDS: Record<Kind, { done: string; pending: string; noun: string }> = {
  check_in: { done: "Checked in", pending: "Recording check-in…", noun: "check-in" },
  check_out: { done: "Checked out", pending: "Recording check-out…", noun: "check-out" },
};

const fetchToday = () => fetchJson("/api/attendance/today", todaySchema);

/** The newer of two snapshots of today (server render vs. the client's last fetch). */
const newest = (a: Today | undefined, b: Today | null) =>
  !a ? b : !b ? a : Date.parse(a.serverTime) >= Date.parse(b.serverTime) ? a : b;

type Notice = { tone: "error" | "info"; text: string; requestId?: string | null };

type TodayCardProps = {
  /** From the page's server render; null when that read failed (state K). */
  initialToday: Today | null;
  /** What this employee's organization needs for attendance; null when there's nothing to ask. */
  initialChecks?: MyVerification | null;
  /** The organization's support contact, for the "Contact Admin/HR" state. */
  supportContact: React.ReactNode;
};

/**
 * UX_FLOWS.md §7 — today's status and the one action that fits it. The server decides
 * the state; success shows only once the backend confirms (no optimistic UI). Every
 * intent has one Idempotency-Key, reused for its retries, so double clicks and retries
 * after a lost response can never record twice. While the organization has a check on,
 * both actions go through the camera and location first, and nothing is recorded without them.
 */
export function TodayCard({ initialToday, initialChecks = null, supportContact }: TodayCardProps) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: attendanceKeys.today(),
    queryFn: fetchToday,
    initialData: initialToday ?? undefined,
    staleTime: 30_000,
    // Pauses while the tab is hidden; refetches when it's back
    refetchInterval: TODAY_POLL_MS,
  });
  const today = newest(query.data, initialToday);
  const checks = useMyVerification(initialChecks);
  const needsEvidence = Boolean(checks?.location.enabled || checks?.selfie.enabled);
  const { refetch, dataUpdatedAt } = query;

  const [isPending, startTransition] = useTransition();
  const [pendingKind, setPendingKind] = useState<Kind | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  /** After an unconfirmed result: re-check the state before offering any new action. */
  const [mustRecheck, setMustRecheck] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  /** The action waiting for its evidence, and the step it's on. */
  const [capture, setCapture] = useState<{ kind: Kind; step: "notice" | "camera" } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const intent = useRef<{ kind: Kind; workDate: string; key: string } | null>(null);
  const busy = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Re-check when check-in opens or closes, or the check-out deadline passes
  useEffect(() => {
    const boundary = today && nextBoundary(today);
    if (!today || !boundary) return;
    const estimatedNow = Date.parse(today.serverTime) + (Date.now() - dataUpdatedAt);
    const delay = Math.max(0, Date.parse(boundary) - estimatedNow) + 1000;
    if (delay > 2 ** 31 - 1) return;
    const id = setTimeout(() => void refetch(), delay);
    return () => clearTimeout(id);
  }, [today, dataUpdatedAt, refetch]);

  const confirmed = (kind: Kind, at: string, timeZone: string) => {
    intent.current = null;
    const text = `${WORDS[kind].done} at ${formatClock(at, timeZone)}.`;
    setNotice(null);
    setAnnouncement(text);
    toast.success(text);
    headingRef.current?.focus();
  };

  /** Reads today's state again; if the intent turned out recorded, says so. */
  const recheck = async (kind: Kind | null, requestId: string | null = null) => {
    let fresh: Today;
    try {
      fresh = await queryClient.fetchQuery({
        queryKey: attendanceKeys.today(),
        queryFn: fetchToday,
        staleTime: 0,
      });
    } catch {
      setNotice({
        tone: "error",
        text: "We still can't reach the server. Check your connection, then check your status again.",
        requestId,
      });
      return;
    }
    setMustRecheck(false);
    const at = kind === "check_in" ? fresh.record?.checkInAt : fresh.record?.checkOutAt;
    if (kind && at) return confirmed(kind, at, fresh.schedule?.timezone ?? fresh.timezone);
    setNotice(
      kind
        ? {
            tone: "error",
            text: `Your ${WORDS[kind].noun} wasn't recorded. Try again.`,
            requestId,
          }
        : null,
    );
  };

  const settle = async (kind: Kind, outcome: AttendanceOutcome) => {
    if (outcome.kind === "recorded") {
      if (outcome.today) queryClient.setQueryData(attendanceKeys.today(), outcome.today);
      else void refetch();
      void queryClient.invalidateQueries({ queryKey: verificationKeys.mine() });
      return confirmed(kind, outcome.at, outcome.timezone);
    }
    if (outcome.kind === "rejected") {
      intent.current = null;
      if (outcome.today) queryClient.setQueryData(attendanceKeys.today(), outcome.today);
      setNotice({ tone: "error", text: outcome.message });
      return;
    }
    // Unknown result: keep the intent (and its key) for a safe retry, but look first
    setMustRecheck(true);
    setNotice({ tone: "info", text: outcome.message, requestId: outcome.requestId });
    await recheck(kind, outcome.requestId);
  };

  const run = (kind: Kind, evidence?: Evidence) => {
    if (busy.current || !today) return;
    busy.current = true;
    const previous = intent.current;
    const key =
      previous?.kind === kind && previous.workDate === today.workDate
        ? previous.key
        : crypto.randomUUID();
    intent.current = { kind, workDate: today.workDate, key };
    setNotice(null);
    setAnnouncement(WORDS[kind].pending);
    setPendingKind(kind);
    startTransition(async () => {
      try {
        const action = kind === "check_in" ? checkInAction : checkOutAction;
        let outcome: AttendanceOutcome;
        try {
          const result = await (evidence ? action(key, evidence) : action(key));
          if (!result.ok) {
            intent.current = null;
            setNotice({ tone: "error", text: result.error });
            return;
          }
          outcome = result.data;
        } catch {
          // The response never arrived: the request may or may not have been recorded
          outcome = {
            kind: "unconfirmed",
            message: "We couldn't confirm the result. Checking your status…",
            requestId: null,
          };
        }
        await settle(kind, outcome);
      } finally {
        busy.current = false;
        setPendingKind(null);
      }
    });
  };

  const begin = (kind: Kind) => {
    if (needsEvidence) {
      setCapture({ kind, step: checks?.notice.acknowledged ? "camera" : "notice" });
    } else if (kind === "check_in") {
      run(kind);
    } else {
      setConfirmOpen(true);
    }
  };

  if (!today) {
    return (
      <Card aria-labelledby="today-status">
        <CardHeader>
          <h2 id="today-status" className="text-lg font-semibold">
            Today&apos;s status
          </h2>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-3">
          <p role="alert" className="text-sm">
            We couldn&apos;t load your attendance status. Try again.
          </p>
          <Button variant="outline" onClick={() => void refetch()} disabled={query.isFetching}>
            <RefreshCwIcon aria-hidden className={query.isFetching ? "animate-spin" : undefined} />
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const view = describeToday(today);
  const zone = today.schedule?.timezone ?? today.timezone;
  const working = isPending || pendingKind !== null;
  const loadFailed = query.isError && !working;

  return (
    <Card aria-labelledby="today-status" className="w-full">
      <CardHeader className="gap-1">
        <p className="text-sm font-medium">{formatLongDate(today.workDate)}</p>
        <p className="text-sm text-muted-foreground">
          Organization time:{" "}
          <OrgClock key={today.serverTime} serverTime={today.serverTime} timeZone={zone} />
        </p>
        {today.schedule && (
          <p className="text-sm text-muted-foreground">Schedule {scheduleLine(today.schedule)}</p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Status
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <h2
              id="today-status"
              ref={headingRef}
              tabIndex={-1}
              className="text-xl font-semibold tracking-tight outline-none"
            >
              {view.title}
            </h2>
            {view.status && <StatusBadge status={view.status} />}
          </div>
          {view.lines.map((line) => (
            <p key={line} className="text-sm">
              {line}
            </p>
          ))}
        </div>

        {notice && (
          <Alert variant={notice.tone === "error" ? "destructive" : "default"}>
            <AlertDescription>
              {notice.text}
              {notice.requestId && (
                <span className="block text-xs text-muted-foreground">
                  Reference: {notice.requestId}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}
        {loadFailed && (
          <Alert>
            <AlertDescription>
              We couldn&apos;t load your attendance status. Showing the last confirmed status from{" "}
              {formatClock(today.serverTime, zone)}.
            </AlertDescription>
          </Alert>
        )}

        <PrimaryAction
          view={view}
          today={today}
          mustRecheck={mustRecheck || loadFailed}
          pendingKind={pendingKind}
          isFetching={query.isFetching}
          supportContact={supportContact}
          onCheckIn={() => begin("check_in")}
          onCheckOut={() => begin("check_out")}
          onRecheck={() =>
            loadFailed
              ? void refetch()
              : startTransition(() => recheck(intent.current?.kind ?? null))
          }
        />
        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>
        {checks && needsEvidence && <VerificationSection mine={checks} />}
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        {needsEvidence
          ? "Server time is the official time."
          : "Server time is the official time. Hadir.in records only your check-in and check-out."}
      </CardFooter>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Finish today's attendance?"
        description={
          <>
            {today.record?.checkInAt &&
              `You checked in at ${formatClock(today.record.checkInAt, zone)}. `}
            Your check-out is recorded at the server&apos;s time when you confirm.
          </>
        }
        confirmLabel="Yes, check out"
        onConfirm={async () => run("check_out")}
      />
      {capture && checks && (
        <>
          <NoticeDialog
            open={capture.step === "notice"}
            onOpenChange={(open) => !open && setCapture(null)}
            location={checks.location.enabled}
            selfie={checks.selfie.enabled}
            onAcknowledged={() => setCapture({ kind: capture.kind, step: "camera" })}
          />
          <CaptureDialog
            open={capture.step === "camera"}
            onOpenChange={(open) => !open && setCapture(null)}
            moment={capture.kind}
            photo={checks.selfie.enabled}
            location={checks.location.enabled}
            onCaptured={(evidence) => run(capture.kind, evidence)}
          />
        </>
      )}
    </Card>
  );
}

function PrimaryAction({
  view,
  today,
  mustRecheck,
  pendingKind,
  isFetching,
  supportContact,
  onCheckIn,
  onCheckOut,
  onRecheck,
}: {
  view: ReturnType<typeof describeToday>;
  today: Today;
  mustRecheck: boolean;
  pendingKind: Kind | null;
  isFetching: boolean;
  supportContact: React.ReactNode;
  onCheckIn: () => void;
  onCheckOut: () => void;
  onRecheck: () => void;
}) {
  // A large, full-width target on phones (UX_FLOWS.md §19: at least 44×44 px)
  const big = "h-11 w-full sm:w-auto sm:min-w-48";

  if (pendingKind) {
    return (
      <Button size="lg" className={big} disabled aria-disabled>
        <LoaderCircleIcon aria-hidden className="animate-spin" />
        {WORDS[pendingKind].pending}
      </Button>
    );
  }
  if (mustRecheck && (view.action.kind === "check_in" || view.action.kind === "check_out")) {
    return (
      <Button size="lg" variant="outline" className={big} onClick={onRecheck} disabled={isFetching}>
        <RefreshCwIcon aria-hidden className={isFetching ? "animate-spin" : undefined} />
        Check my status
      </Button>
    );
  }

  switch (view.action.kind) {
    case "check_in":
      return (
        <Button size="lg" className={big} onClick={onCheckIn} disabled={!today.canCheckIn}>
          <LogInIcon aria-hidden />
          Check in
        </Button>
      );
    case "check_out":
      return (
        <Button size="lg" className={big} onClick={onCheckOut} disabled={!today.canCheckOut}>
          <LogOutIcon aria-hidden />
          Check out
        </Button>
      );
    case "request_correction":
      return (
        <Button size="lg" variant="outline" className={big} asChild>
          <Link href={routes.newCorrection(view.action.attendanceId)}>Request correction</Link>
        </Button>
      );
    case "history":
      return (
        <Button variant="outline" className="h-11 w-full sm:w-auto sm:self-start" asChild>
          <Link href={routes.attendanceHistory()}>View history</Link>
        </Button>
      );
    case "contact_support":
      return <p className="text-sm">Contact Admin/HR: {supportContact}</p>;
    case "none":
      return null;
  }
}
