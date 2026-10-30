import {
  createLoader,
  createSerializer,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  type inferParserType,
} from "nuqs/server";

import { routes } from "@/config/routes";
import { HISTORY_STATUSES, HISTORY_VIEWS } from "@/features/attendance/constants";

// docs/11-state-and-url-params.md — the one definition of My History's URL.
export const historySearchParams = {
  view: parseAsStringLiteral(HISTORY_VIEWS).withDefault("daily"),
  /** Daily view range (work dates, inclusive). Empty: the current month. */
  from: parseAsString.withDefault(""),
  to: parseAsString.withDefault(""),
  status: parseAsStringLiteral(HISTORY_STATUSES),
  page: parseAsInteger.withDefault(1),
  /** Monthly view ("2026-10"). Empty: the current month. */
  month: parseAsString.withDefault(""),
};

export const loadHistorySearchParams = createLoader(historySearchParams);
export type HistoryFilters = inferParserType<typeof historySearchParams>;

const serialize = createSerializer(historySearchParams);

/** A link to My History with these filters. Defaults are left out of the URL. */
export const historyHref = (filters: Partial<HistoryFilters>) =>
  serialize(routes.attendanceHistory(), filters);
