import "server-only";

import { cache } from "react";

import { PAGE_SIZE } from "@/config/constants";
import {
  emailPreferencesSchema,
  notificationListSchema,
  unreadCountSchema,
} from "@/features/notifications/schemas";
import { apiFetch } from "@/lib/api/client";

// docs/08-data-fetching.md — the caller's own notifications (backend /v1/notifications).

/** Delivered notifications, newest first (DOMAIN_RULES.md §18.6). */
export const listMyNotifications = cache(
  (query: { page?: number; pageSize?: number; unread?: boolean }) => {
    const params = new URLSearchParams({
      page: String(query.page ?? 1),
      pageSize: String(query.pageSize ?? PAGE_SIZE),
    });
    if (query.unread) params.set("unread", "true");
    return apiFetch(`/notifications/me?${params}`, { schema: notificationListSchema });
  },
);

export const getUnreadCount = cache(async () => {
  const { count } = await apiFetch("/notifications/me/unread-count", { schema: unreadCountSchema });
  return count;
});

export const getEmailPreferences = cache(() =>
  apiFetch("/notifications/preferences", { schema: emailPreferencesSchema }),
);
