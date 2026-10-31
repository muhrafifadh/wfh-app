import "server-only";

import { cache } from "react";

import { OPTIONS_PAGE_SIZE } from "@/config/constants";
import { holidayListSchema } from "@/features/holidays/schemas";
import { apiFetch } from "@/lib/api/client";

// docs/08-data-fetching.md — reads for the holidays page (backend /v1/holidays).

/** A year's holidays, by date. A year never has more than a page of 100. */
export const listHolidays = cache(async (year: number) => {
  const params = new URLSearchParams({
    from: `${year}-01-01`,
    to: `${year}-12-31`,
    pageSize: String(OPTIONS_PAGE_SIZE),
  });
  return (await apiFetch(`/holidays?${params}`, { schema: holidayListSchema })).items;
});
