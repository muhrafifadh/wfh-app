import { createLoader, createSerializer, parseAsInteger, type inferParserType } from "nuqs/server";

import { routes } from "@/config/routes";

// docs/11-state-and-url-params.md — the holidays page shows one year at a time.
export const holidaySearchParams = {
  /** Null: the organization's current year. */
  year: parseAsInteger,
};

export const loadHolidaySearchParams = createLoader(holidaySearchParams);
export type HolidayFilters = inferParserType<typeof holidaySearchParams>;

const serialize = createSerializer(holidaySearchParams);

export const holidayListHref = (year: number) => serialize(routes.holidays(), { year });
