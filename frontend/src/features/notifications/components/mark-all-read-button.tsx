"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { markAllNotificationsReadAction } from "@/features/notifications/actions";
import { notificationKeys } from "@/features/notifications/query-keys";

export function MarkAllReadButton() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  const markAll = () =>
    startTransition(async () => {
      const result = await markAllNotificationsReadAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      void queryClient.invalidateQueries({ queryKey: notificationKeys.summary() });
      router.refresh();
    });

  return (
    <Button variant="outline" onClick={markAll} disabled={isPending}>
      {isPending ? "Marking…" : "Mark all as read"}
    </Button>
  );
}
