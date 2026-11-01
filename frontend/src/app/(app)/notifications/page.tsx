import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/shared/list-pagination";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { routes } from "@/config/routes";
import { MarkAllReadButton } from "@/features/notifications/components/mark-all-read-button";
import { NotificationItems } from "@/features/notifications/components/notification-items";
import { listMyNotifications } from "@/features/notifications/queries";
import {
  loadNotificationsSearchParams,
  notificationsHref,
  type NotificationsFilters,
} from "@/features/notifications/search-params";
import { requireUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };

// DOMAIN_RULES.md §18.6 — everyone's own notifications, newest first.
export default async function NotificationsPage({ searchParams }: PageProps<"/notifications">) {
  await requireUser();
  const filters = await loadNotificationsSearchParams(searchParams);
  const unreadOnly = filters.show === "unread";
  const tabs = [
    { label: "All", href: notificationsHref({ show: null }), active: !unreadOnly },
    { label: "Unread", href: notificationsHref({ show: "unread" }), active: unreadOnly },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        <MarkAllReadButton />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Show" className="flex gap-1 rounded-lg bg-muted p-1 sm:w-fit">
          {tabs.map((tab) => (
            <Link
              key={tab.label}
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium",
                tab.active
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        <Link
          href={routes.profile()}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Email preferences
        </Link>
      </div>
      <Suspense
        key={JSON.stringify(filters)}
        fallback={<TableSkeleton rows={4} label="Loading notifications" />}
      >
        <NotificationsList filters={filters} />
      </Suspense>
    </>
  );
}

async function NotificationsList({ filters }: { filters: NotificationsFilters }) {
  const unreadOnly = filters.show === "unread";
  const list = await listMyNotifications({ page: filters.page, unread: unreadOnly });
  return list.items.length > 0 ? (
    <>
      <NotificationItems items={list.items} />
      <ListPagination
        page={list.page}
        pageSize={list.pageSize}
        total={list.total}
        hrefFor={(page) => notificationsHref({ ...filters, page })}
      />
    </>
  ) : (
    <EmptyState
      title={unreadOnly ? "Nothing unread" : "No notifications yet"}
      description={
        unreadOnly
          ? "You've read everything."
          : "Correction updates and attendance reminders will show up here."
      }
    />
  );
}
