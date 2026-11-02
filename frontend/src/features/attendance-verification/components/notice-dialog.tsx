"use client";

import { useTransition } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { acknowledgeNoticeAction } from "@/features/attendance-verification/actions";
import { NoticeText } from "@/features/attendance-verification/components/notice-text";
import { verificationKeys } from "@/features/attendance-verification/query-keys";

type NoticeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: boolean;
  selfie: boolean;
  onAcknowledged: () => void;
};

/** Principle 4: employees are told before anything is collected. */
export function NoticeDialog({
  open,
  onOpenChange,
  location,
  selfie,
  onAcknowledged,
}: NoticeDialogProps) {
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Attendance checks</DialogTitle>
          <DialogDescription>
            What is collected at check-in and check-out, and why.
          </DialogDescription>
        </DialogHeader>
        <NoticeText location={location} selfie={selfie} />
        <DialogFooter>
          <Button
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const result = await acknowledgeNoticeAction();
                if (!result.ok) return void toast.error(result.error);
                await queryClient.invalidateQueries({ queryKey: verificationKeys.mine() });
                onOpenChange(false);
                onAcknowledged();
              })
            }
          >
            I&apos;ve read this
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
