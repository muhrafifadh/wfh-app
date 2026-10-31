import "server-only";

import { cache } from "react";

import { PAGE_SIZE } from "@/config/constants";
import { uploadListSchema } from "@/features/files/schemas";
import type { FileFilters } from "@/features/files/search-params";
import { apiFetch } from "@/lib/api/client";

/** Completed uploads, each with a download link that works for 15 minutes. */
export const listFiles = cache(async (filters: FileFilters) => {
  const params = new URLSearchParams({ page: String(filters.page), pageSize: String(PAGE_SIZE) });
  if (filters.q) params.set("q", filters.q);
  return apiFetch(`/uploads?${params}`, { schema: uploadListSchema });
});
