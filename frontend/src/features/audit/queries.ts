import "server-only";

import { cache } from "react";

import { PAGE_SIZE } from "@/config/constants";
import { auditLogListSchema } from "@/features/audit/schemas";
import type { AuditFilters } from "@/features/audit/search-params";
import { apiFetch } from "@/lib/api/client";

export const listAuditLogs = cache(async (filters: AuditFilters) => {
  const params = new URLSearchParams({ page: String(filters.page), pageSize: String(PAGE_SIZE) });
  if (filters.action) params.set("action", filters.action);
  return apiFetch(`/audit-logs?${params}`, { schema: auditLogListSchema });
});
