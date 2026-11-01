"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { routes } from "@/config/routes";
import { markAllNotificationsReadAction } from "@/features/notifications/actions";
import { NotificationItems } from "@/features/notifications/components/notification-items";
import { notificationKeys } from "@/features/notifications/query-keys";
import { notificationSummarySchema } from "@/features/notifications/schemas";
import { fetchJson } from "@/lib/api/fetch-json";

/** New notifications arrive at most every 5 minutes (reminders) or on an action. */
const POLL_MS = 60_000;

/**
 * DOMAIN_RULES.md §18.6 — the header bell: unread count and the latest few, polled
 * while the tab is visible and on focus. The full list is on /notifications.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [isMarking, startMarking] = useTransition();
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: notificationKeys.summary(),
    queryFn: () => fetchJson(routes.notificationSummary(), notificationSummarySchema),
    refetchInterval: POLL_MS,
    staleTime: 15_000,
  });
  const unread = data?.unread ?? 0;
  const items = data?.items ?? [];

  const markAll = () =>
    startMarking(async () => {
      const result = await markAllNotificationsReadAction();
      if (!result.ok) toast.error(result.error);
      await queryClient.invalidateQueries({ queryKey: notificationKeys.summary() });
    });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        >
          <BellIcon aria-hidden />
          {unread > 0 && (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground tabular-nums"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-2">
        <div className="flex items-center justify-between gap-2 px-2 pt-1 pb-2">
          <h2 className="text-sm font-semibold">Notifications</h2>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={markAll} disabled={isMarking}>
              Mark all as read
            </Button>
          )}
        </div>
        {items.length > 0 ? (
          <div className="max-h-96 overflow-y-auto">
            <NotificationItems items={items} onOpen={() => setOpen(false)} compact />
          </div>
        ) : (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            No notifications yet.
          </p>
        )}
        <div className="border-t px-2 pt-2">
          <Link
            href={routes.notifications()}
            onClick={() => setOpen(false)}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            View all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
