"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CameraIcon, MapPinIcon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { routes } from "@/config/routes";
import { attendanceKeys } from "@/features/attendance/query-keys";
import { todaySchema } from "@/features/attendance/schemas";
import {
  acknowledgeNoticeAction,
  completeSelfieAction,
  requestWorkLocationAction,
  startSelfieAction,
  submitLocationAction,
} from "@/features/attendance-verification/actions";
import { CameraDialog } from "@/features/attendance-verification/components/camera-dialog";
import { readLocation } from "@/features/attendance-verification/components/geolocation";
import { NoticeText } from "@/features/attendance-verification/components/notice-text";
import { ResultBadge } from "@/features/attendance-verification/components/result-badge";
import { verificationKeys } from "@/features/attendance-verification/query-keys";
import {
  myVerificationSchema,
  type MyVerification,
} from "@/features/attendance-verification/schemas";
import { fetchJson } from "@/lib/api/fetch-json";

const fetchMine = () => fetchJson(routes.myVerificationApi(), myVerificationSchema);
const fetchToday = () => fetchJson("/api/attendance/today", todaySchema);

/**
 * ATTENDANCE_VERIFICATION_PLAN.md — the optional checks after check-in, next to today's
 * card. Renders nothing while both methods are off. Nothing here can change the check-in:
 * it is already recorded, and every failure says so.
 */
export function VerificationPanel({ initial }: { initial: MyVerification }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: verificationKeys.mine(),
    queryFn: fetchMine,
    initialData: initial,
    staleTime: 30_000,
  });
  const mine = query.data;
  // Today's card owns and fetches this query; this only watches it. A new check-in
  // means new results to show.
  const checkedInAt = useQuery({
    queryKey: attendanceKeys.today(),
    queryFn: fetchToday,
    enabled: false,
  }).data?.record?.checkInAt;
  const seen = useRef(checkedInAt);
  const { refetch } = query;
  useEffect(() => {
    if (checkedInAt && checkedInAt !== seen.current) void refetch();
    seen.current = checkedInAt;
  }, [checkedInAt, refetch]);

  const [isPending, startTransition] = useTransition();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);

  if (!mine.location.enabled && !mine.selfie.enabled) return null;
  const set = (next: MyVerification) => queryClient.setQueryData(verificationKeys.mine(), next);

  const shareLocation = () =>
    startTransition(async () => {
      const reading = await readLocation();
      if (!reading) {
        toast.info("Location wasn't shared. You're still checked in.");
        return;
      }
      const result = await submitLocationAction(reading);
      if (!result.ok) return void toast.error(result.error);
      set(result.data);
      toast.success(
        result.data.location.result === "low_accuracy"
          ? "Couldn't confirm your location. You're still checked in, and you can try again."
          : "Location check recorded.",
      );
    });

  const savePhoto = async (photo: Blob): Promise<string | null> => {
    const started = await startSelfieAction({ contentType: "image/jpeg", size: photo.size });
    if (!started.ok) return started.error;
    const put = await fetch(started.data.uploadUrl, {
      method: "PUT",
      headers: started.data.uploadHeaders,
      body: photo,
    }).catch(() => null);
    if (!put?.ok) return "The photo didn't upload. Check your connection and try again.";
    const completed = await completeSelfieAction();
    if (!completed.ok) return completed.error;
    set(completed.data);
    toast.success("Check-in photo saved.");
    return null;
  };

  return (
    <Card aria-labelledby="verification-heading">
      <CardHeader>
        <CardTitle>
          <h2 id="verification-heading" className="flex items-center gap-2">
            <ShieldCheckIcon aria-hidden className="size-4" />
            Attendance checks
          </h2>
        </CardTitle>
        <CardDescription>
          Optional evidence for your check-in. It never changes your attendance.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {!mine.notice.acknowledged ? (
          <div className="grid gap-3">
            <p className="text-sm">Read how these checks work before anything is collected.</p>
            <div>
              <Button onClick={() => setNoticeOpen(true)}>Read the notice</Button>
            </div>
          </div>
        ) : (
          <>
            {mine.location.enabled && (
              <LocationSection
                mine={mine}
                checkedIn={Boolean(checkedInAt)}
                busy={isPending}
                onShare={shareLocation}
                onSaved={set}
              />
            )}
            {mine.selfie.enabled && (
              <section aria-label="Check-in photo" className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium">Photo</span>
                {mine.selfie.result ? (
                  <ResultBadge result={mine.selfie.result} />
                ) : (
                  <NoResult checkedIn={Boolean(checkedInAt)} />
                )}
                {mine.selfie.canSubmit && (
                  <Button variant="outline" size="sm" onClick={() => setCameraOpen(true)}>
                    <CameraIcon aria-hidden />
                    Take check-in photo
                  </Button>
                )}
              </section>
            )}
            <Link
              href={routes.myVerification()}
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              My check-in evidence
            </Link>
          </>
        )}
      </CardContent>

      <Dialog open={noticeOpen} onOpenChange={setNoticeOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Attendance checks</DialogTitle>
            <DialogDescription>What is collected at check-in, and why.</DialogDescription>
          </DialogHeader>
          <NoticeText location={mine.location.enabled} selfie={mine.selfie.enabled} />
          <DialogFooter>
            <Button
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const result = await acknowledgeNoticeAction();
                  if (!result.ok) return void toast.error(result.error);
                  setNoticeOpen(false);
                  await refetch();
                })
              }
            >
              I&apos;ve read this
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CameraDialog open={cameraOpen} onOpenChange={setCameraOpen} onSave={savePhoto} />
    </Card>
  );
}

/** Before check-in there is nothing yet; a check-in made before a method was on has none. */
function NoResult({ checkedIn }: { checkedIn: boolean }) {
  return (
    <span className="text-sm text-muted-foreground">
      {checkedIn ? "Not recorded for today's check-in" : "After you check in"}
    </span>
  );
}

function LocationSection({
  mine,
  checkedIn,
  busy,
  onShare,
  onSaved,
}: {
  mine: MyVerification;
  checkedIn: boolean;
  busy: boolean;
  onShare: () => void;
  onSaved: (next: MyVerification) => void;
}) {
  const { approved, pending } = mine.workLocation;
  const [changing, setChanging] = useState(false);

  return (
    <section aria-label="Location check" className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">Location</span>
        {mine.location.result ? (
          <ResultBadge result={mine.location.result} />
        ) : (
          <NoResult checkedIn={checkedIn} />
        )}
        {mine.location.canSubmit && (
          <Button variant="outline" size="sm" onClick={onShare} disabled={busy}>
            <MapPinIcon aria-hidden />
            {mine.location.result === "low_accuracy" ? "Try again" : "Share my location"}
          </Button>
        )}
      </div>
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
