"use client";

import { useEffect, useRef, useState } from "react";

import { CameraIcon, MapPinIcon, RotateCcwIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { startPhotoUploadAction } from "@/features/attendance-verification/actions";
import { readLocation } from "@/features/attendance-verification/components/geolocation";
import {
  MAX_PHOTO_BYTES,
  MOMENT_LABELS,
  type VerificationMoment,
} from "@/features/attendance-verification/constants";
import type { Evidence } from "@/features/attendance-verification/schemas";

/** Small enough for the 2 MB limit, large enough for a person to recognise a face. */
const MAX_EDGE = 640;

const NO_CAMERA = "Allow the camera for this site, then try again.";
const NO_LOCATION = "Allow location for this site, then try again.";

type CaptureDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moment: VerificationMoment;
  photo: boolean;
  location: boolean;
  /** The photo is uploaded by now; recording the attendance is the caller's job. */
  onCaptured: (evidence: Evidence) => void;
};

function grabFrame(source: HTMLVideoElement): Promise<Blob | null> {
  const scale = Math.min(1, MAX_EDGE / Math.max(source.videoWidth, source.videoHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(source.videoWidth * scale);
  canvas.height = Math.round(source.videoHeight * scale);
  canvas.getContext("2d")?.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
}

/**
 * ATTENDANCE_VERIFICATION_PLAN.md §3 — what a check-in or check-out needs: one camera
 * photo, never a gallery upload, with a retake, and one location reading taken with the
 * photo. Closing the dialog records nothing.
 */
export function CaptureDialog({
  open,
  onOpenChange,
  moment,
  photo,
  location,
  onCaptured,
}: CaptureDialogProps) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [shot, setShot] = useState<{ blob: Blob; url: string; evidence: Evidence } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [busy, setBusy] = useState<"locating" | "saving" | null>(null);
  const label = MOMENT_LABELS[moment];

  useEffect(() => {
    if (!open || !photo || shot) return;
    let cancelled = false;
    const camera =
      navigator.mediaDevices?.getUserMedia?.({ video: { facingMode: "user" }, audio: false }) ??
      Promise.reject(new Error("No camera"));
    camera
      .then((media) => {
        if (cancelled) return media.getTracks().forEach((track) => track.stop());
        stream.current = media;
        if (video.current) video.current.srcObject = media;
        setCameraReady(true);
      })
      .catch(() => setError(NO_CAMERA));
    return () => {
      cancelled = true;
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
      setCameraReady(false);
    };
  }, [open, photo, shot]);

  useEffect(
    () => () => {
      if (shot) URL.revokeObjectURL(shot.url);
    },
    [shot],
  );

  async function readIfNeeded(): Promise<Evidence | null> {
    if (!location) return {};
    const reading = await readLocation();
    if (!reading) {
      setError(NO_LOCATION);
      return null;
    }
    return { location: reading };
  }

  async function take() {
    setError(null);
    setBusy("locating");
    const source = video.current;
    if (!source || source.videoWidth === 0) {
      setBusy(null);
      return;
    }
    const [blob, evidence] = await Promise.all([grabFrame(source), readIfNeeded()]);
    setBusy(null);
    if (!evidence) return;
    if (!blob || blob.size > MAX_PHOTO_BYTES) {
      setError("That photo is too large. Take it again.");
      return;
    }
    setShot({ blob, url: URL.createObjectURL(blob), evidence });
  }

  async function shareLocation() {
    setError(null);
    setBusy("locating");
    const evidence = await readIfNeeded();
    setBusy(null);
    if (evidence) finish(evidence);
  }

  async function confirmPhoto() {
    if (!shot) return;
    setError(null);
    setBusy("saving");
    const started = await startPhotoUploadAction({
      moment,
      contentType: "image/jpeg",
      size: shot.blob.size,
    });
    if (!started.ok) {
      setBusy(null);
      setError(started.error);
      return;
    }
    const put = await fetch(started.data.uploadUrl, {
      method: "PUT",
      headers: started.data.uploadHeaders,
      body: shot.blob,
    }).catch(() => null);
    setBusy(null);
    if (!put?.ok) {
      setError("The photo didn't upload. Check your connection and try again.");
      return;
    }
    finish(shot.evidence);
  }

  function finish(evidence: Evidence) {
    close(false);
    onCaptured(evidence);
  }

  function close(next: boolean) {
    if (!next) {
      setShot(null);
      setError(null);
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{photo ? `${label} photo` : `${label} location`}</DialogTitle>
          <DialogDescription>
            {photo
              ? `Your ${label.toLowerCase()} is recorded once you've taken this photo. Frame only yourself. It's kept for 30 days, and only authorized Admin/HR can open it.`
              : `Your ${label.toLowerCase()} is recorded once you've shared your location.`}
            {photo && location && " Your location is read when you take the photo."}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              {error} Your {label.toLowerCase()} isn&apos;t recorded yet.
            </AlertDescription>
          </Alert>
        )}
        {photo && (
          <div className="overflow-hidden rounded-md bg-muted">
            {shot ? (
              // A blob URL of the photo just taken; next/image can't optimise it
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shot.url} alt="You, as just captured" className="w-full" />
            ) : (
              <video
                ref={video}
                autoPlay
                playsInline
                muted
                aria-label="Camera preview"
                className="w-full"
              />
            )}
          </div>
        )}
        <DialogFooter>
          {!photo ? (
            <Button onClick={() => void shareLocation()} disabled={busy !== null}>
              <MapPinIcon aria-hidden />
              {busy ? "Getting your location…" : "Share my location"}
            </Button>
          ) : shot ? (
            <>
              <Button variant="outline" onClick={() => setShot(null)} disabled={busy !== null}>
                <RotateCcwIcon aria-hidden />
                Retake
              </Button>
              <Button onClick={() => void confirmPhoto()} disabled={busy !== null}>
                {busy === "saving" ? "Saving…" : "Use this photo"}
              </Button>
            </>
          ) : (
            <Button onClick={() => void take()} disabled={!cameraReady || busy !== null}>
              <CameraIcon aria-hidden />
              {busy && location ? "Getting your location…" : "Take photo"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
