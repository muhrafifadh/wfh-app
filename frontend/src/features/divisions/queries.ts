import "server-only";

import { cache } from "react";

import { PAGE_SIZE } from "@/config/constants";
import { divisionListSchema } from "@/features/divisions/schemas";
import type { DivisionFilters } from "@/features/divisions/search-params";
import { apiFetch } from "@/lib/api/client";

// docs/08-data-fetching.md — reads for the divisions page (backend /v1/divisions).

export const listDivisions = cache(async (filters: DivisionFilters) => {
  const params = new URLSearchParams({
    page: String(filters.page),
    pageSize: String(PAGE_SIZE),
    sort: `${filters.order === "desc" ? "-" : ""}${filters.sort}`,
  });
  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  return apiFetch(`/divisions?${params}`, { schema: divisionListSchema });
});
