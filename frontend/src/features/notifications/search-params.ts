import {
  createLoader,
  createSerializer,
  parseAsInteger,
  parseAsStringLiteral,
  type inferParserType,
} from "nuqs/server";

import { routes } from "@/config/routes";

// docs/11-state-and-url-params.md — /notifications: all or unread, and the page.
export const notificationsSearchParams = {
  show: parseAsStringLiteral(["unread"] as const),
  page: parseAsInteger.withDefault(1),
};
export const loadNotificationsSearchParams = createLoader(notificationsSearchParams);
export type NotificationsFilters = inferParserType<typeof notificationsSearchParams>;
const serialize = createSerializer(notificationsSearchParams);
export const notificationsHref = (filters: Partial<NotificationsFilters>) =>
  serialize(routes.notifications(), filters);
