"use client";

import { useState, useTransition } from "react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  reviewVerificationAction,
  viewPhotoAction,
} from "@/features/attendance-verification/actions";

export function MarkReviewedButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await reviewVerificationAction(id);
          if (!result.ok) toast.error(result.error);
        })
      }
    >
      Mark reviewed
    </Button>
  );
}

/** Decision V9: each opening asks the backend again, which records it in the audit log. */
export function ViewPhotoButton({ id, employeeName }: { id: string; employeeName: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await viewPhotoAction(id);
            if (!result.ok) return void toast.error(result.error);
            setUrl(result.data.url);
          })
        }
      >
        View photo
      </Button>
      <Dialog open={url !== null} onOpenChange={(open) => !open && setUrl(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check-in photo</DialogTitle>
            <DialogDescription>
              {employeeName}. This view is recorded in the audit log.
            </DialogDescription>
          </DialogHeader>
          {url && (
            // A short-lived signed link to private storage; next/image would cache it
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={`${employeeName} at check-in`} className="w-full rounded-md" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
