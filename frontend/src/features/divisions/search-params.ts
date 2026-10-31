import {
  createLoader,
  createSerializer,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  type inferParserType,
} from "nuqs/server";

import { SORT_ORDERS } from "@/config/constants";
import { routes } from "@/config/routes";
import { DIVISION_SORT_FIELDS, DIVISION_STATUSES } from "@/features/divisions/constants";

// docs/11-state-and-url-params.md — the one definition of the divisions list's URL.
export const divisionSearchParams = {
  q: parseAsString.withDefault(""),
  status: parseAsStringLiteral(DIVISION_STATUSES),
  sort: parseAsStringLiteral(DIVISION_SORT_FIELDS).withDefault("name"),
  order: parseAsStringLiteral(SORT_ORDERS).withDefault("asc"),
  page: parseAsInteger.withDefault(1),
};

export const loadDivisionSearchParams = createLoader(divisionSearchParams);
export type DivisionFilters = inferParserType<typeof divisionSearchParams>;

const serialize = createSerializer(divisionSearchParams);

/** A link to the divisions list with these filters. Defaults are left out of the URL. */
export const divisionListHref = (filters: Partial<DivisionFilters>) =>
  serialize(routes.divisions(), filters);
