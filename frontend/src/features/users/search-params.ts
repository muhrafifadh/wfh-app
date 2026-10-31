import {
  createLoader,
  createSerializer,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  type inferParserType,
} from "nuqs/server";

import { routes } from "@/config/routes";
import { SORT_ORDERS, USER_SORT_FIELDS, USER_STATUSES } from "@/features/users/constants";

// docs/11-state-and-url-params.md — the one definition of the users list's URL.
export const userSearchParams = {
  q: parseAsString.withDefault(""),
  status: parseAsStringLiteral(USER_STATUSES),
  sort: parseAsStringLiteral(USER_SORT_FIELDS).withDefault("name"),
  order: parseAsStringLiteral(SORT_ORDERS).withDefault("asc"),
  page: parseAsInteger.withDefault(1),
  /** The invite dialog is open (so it survives a refresh and can be linked to). */
  invite: parseAsBoolean.withDefault(false),
};

export const loadUserSearchParams = createLoader(userSearchParams);
export type UserFilters = inferParserType<typeof userSearchParams>;

const serialize = createSerializer(userSearchParams);

/** A link to the users list with these filters. Defaults are left out of the URL. */
export const userListHref = (filters: Partial<UserFilters>) => serialize(routes.users(), filters);
