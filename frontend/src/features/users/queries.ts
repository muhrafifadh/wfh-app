import "server-only";

import { cache } from "react";

import { PAGE_SIZE } from "@/config/constants";
import { roleListSchema, userListSchema, userSchema } from "@/features/users/schemas";
import type { UserFilters } from "@/features/users/search-params";
import { apiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

// docs/08-data-fetching.md — reads for the users pages (backend /v1/users, /v1/roles).

export const listUsers = cache(async (filters: UserFilters) => {
  const params = new URLSearchParams({
    page: String(filters.page),
    pageSize: String(PAGE_SIZE),
    // The API takes "-field" for descending
    sort: `${filters.order === "desc" ? "-" : ""}${filters.sort}`,
  });
  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  return apiFetch(`/users?${params}`, { schema: userListSchema });
});

/** Null when the user doesn't exist or is in another organization. */
export const getUser = cache(async (id: string) => {
  try {
    return await apiFetch(`/users/${encodeURIComponent(id)}`, { schema: userSchema });
  } catch (error) {
    // 400: not a UUID, so it can't exist either
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
});

export const listRoles = cache(
  async () => (await apiFetch("/roles", { schema: roleListSchema })).items,
);
