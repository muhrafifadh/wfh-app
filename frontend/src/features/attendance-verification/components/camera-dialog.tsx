"use client";

import { useEffect, useRef, useState } from "react";

import { CameraIcon, RotateCcwIcon } from "lucide-react";

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
import { MAX_PHOTO_BYTES } from "@/features/attendance-verification/constants";

/** Small enough for the 2 MB limit, large enough for a person to recognise a face. */
const MAX_EDGE = 640;

type CameraDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Returns an error to show, or null once the photo is saved. */
  onSave: (photo: Blob) => Promise<string | null>;
};

/**
 * Decision V6: the camera, never a gallery upload. One photo, with a retake. Closing
 * the dialog or blocking the camera leaves the check-in as it is.
 */
export function CameraDialog({ open, onOpenChange, onSave }: CameraDialogProps) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || photo) return;
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((media) => {
        if (cancelled) return media.getTracks().forEach((track) => track.stop());
        stream.current = media;
        if (video.current) video.current.srcObject = media;
      })
      .catch(() => setError("The camera isn't available or was blocked. You're still checked in."));
    return () => {
      cancelled = true;
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
    };
  }, [open, photo]);

  useEffect(
    () => () => {
      if (photo) URL.revokeObjectURL(photo.url);
    },
    [photo],
  );

  function capture() {
    const source = video.current;
    if (!source || source.videoWidth === 0) return;
    const scale = Math.min(1, MAX_EDGE / Math.max(source.videoWidth, source.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(source.videoWidth * scale);
    canvas.height = Math.round(source.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(source, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.size > MAX_PHOTO_BYTES) {
          setError("That photo is too large. Take it again.");
          return;
        }
        setPhoto({ blob, url: URL.createObjectURL(blob) });
      },
      "image/jpeg",
      0.85,
    );
  }

  async function save() {
    if (!photo) return;
    setSaving(true);
    const failure = await onSave(photo.blob);
    setSaving(false);
    if (failure) setError(failure);
    else close(false);
  }

  function close(next: boolean) {
    if (!next) {
      setPhoto(null);
      setError(null);
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Check-in photo</DialogTitle>
          <DialogDescription>
            Frame only yourself. The photo is kept for 30 days, and only authorized Admin/HR can
            open it.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="overflow-hidden rounded-md bg-muted">
          {photo ? (
            // A blob URL of the photo just taken; next/image can't optimise it
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo.url} alt="You, as just captured" className="w-full" />
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
        <DialogFooter>
          {photo ? (
            <>
              <Button variant="outline" onClick={() => setPhoto(null)} disabled={saving}>
                <RotateCcwIcon aria-hidden />
                Retake
              </Button>
              <Button onClick={() => void save()} disabled={saving}>
                {saving ? "Saving…" : "Use this photo"}
              </Button>
            </>
          ) : (
            <Button onClick={capture} disabled={error !== null && !stream.current}>
              <CameraIcon aria-hidden />
              Take photo
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
