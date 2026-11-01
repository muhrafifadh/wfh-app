"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { markNotificationReadAction } from "@/features/notifications/actions";
import { notificationKeys } from "@/features/notifications/query-keys";
import type { Notification } from "@/features/notifications/schemas";
import { useMeContext } from "@/features/profile/components/me-context-provider";
import { formatDateTimeIn } from "@/lib/time-zone";
import { cn } from "@/lib/utils";

/**
 * DOMAIN_RULES.md §18.6 — one row per notification. Opening one marks it read, then
 * goes to the page it is about. Unread rows say so in words, not only with the dot.
 */
export function NotificationItems({
  items,
  onOpen,
  compact = false,
}: {
  items: Notification[];
  /** Called after a row is opened (the bell closes its popover). */
  onOpen?: () => void;
  compact?: boolean;
}) {
  return (
    <ul className={cn("flex flex-col", !compact && "divide-y rounded-lg border")}>
      {items.map((item) => (
        <li key={item.id}>
          <NotificationRow item={item} onOpen={onOpen} compact={compact} />
        </li>
      ))}
    </ul>
  );
}

function NotificationRow({
  item,
  onOpen,
  compact,
}: {
  item: Notification;
  onOpen?: () => void;
  compact: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { organization } = useMeContext();
  const [isPending, startTransition] = useTransition();
  const unread = item.readAt === null;

  const open = () =>
    startTransition(async () => {
      if (unread) {
        const result = await markNotificationReadAction(item.id);
        if (!result.ok) toast.error(result.error);
        void queryClient.invalidateQueries({ queryKey: notificationKeys.summary() });
      }
      onOpen?.();
      if (item.link) router.push(item.link);
      else router.refresh();
    });

  return (
    <button
      type="button"
      onClick={open}
      disabled={isPending}
      className={cn(
        "flex w-full items-start gap-3 text-left hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none disabled:opacity-60",
        compact ? "rounded-md px-2 py-2" : "px-4 py-3",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-1.5 size-2 shrink-0 rounded-full",
          unread ? "bg-primary" : "bg-transparent",
        )}
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className={cn("text-sm", unread && "font-semibold")}>
          {unread && <span className="sr-only">Unread: </span>}
          {item.title}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatDateTimeIn(item.deliveredAt, organization.timezone)}
        </span>
      </span>
    </button>
  );
}
