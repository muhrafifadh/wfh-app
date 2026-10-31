import "server-only";

import { cache } from "react";

import { z } from "zod";

import { OPTIONS_PAGE_SIZE, PAGE_SIZE } from "@/config/constants";
import {
  divisionOptionsSchema,
  employeeListSchema,
  employeeSchema,
  roleOptionsSchema,
  userOptionsSchema,
} from "@/features/employees/schemas";
import type { EmployeeFilters } from "@/features/employees/search-params";
import { apiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

// docs/08-data-fetching.md — reads for the employees pages (backend /v1/employees).

/** The API rejects ids that aren't UUIDs; an old or hand-typed URL just shows everyone. */
const uuidOrNull = (value: string | null) => (z.uuid().safeParse(value).success ? value : null);

export const listEmployees = cache(async (filters: EmployeeFilters) => {
  const params = new URLSearchParams({
    page: String(filters.page),
    pageSize: String(PAGE_SIZE),
    sort: `${filters.order === "desc" ? "-" : ""}${filters.sort}`,
  });
  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  const divisionId = uuidOrNull(filters.divisionId);
  const managerId = uuidOrNull(filters.managerId);
  if (divisionId) params.set("divisionId", divisionId);
  if (managerId) params.set("managerId", managerId);
  return apiFetch(`/employees?${params}`, { schema: employeeListSchema });
});

/** Null when the employee doesn't exist or is in another organization. */
export const getEmployee = cache(async (id: string) => {
  try {
    return await apiFetch(`/employees/${encodeURIComponent(id)}`, { schema: employeeSchema });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return null;
    throw error;
  }
});

/** Every division, for the division select and filter (inactive ones can't be chosen). */
export const listDivisionOptions = cache(async () => {
  const params = new URLSearchParams({ pageSize: String(OPTIONS_PAGE_SIZE), sort: "name" });
  return (await apiFetch(`/divisions?${params}`, { schema: divisionOptionsSchema })).items;
});

/**
 * Active employees, for the manager select and filter. One page of 100 is enough for the
 * pilot (PRODUCT_REQUIREMENTS.md); a searchable picker replaces it if that's outgrown.
 */
export const listManagerOptions = cache(async () => {
  const params = new URLSearchParams({
    pageSize: String(OPTIONS_PAGE_SIZE),
    status: "active",
    sort: "fullName",
  });
  return (await apiFetch(`/employees?${params}`, { schema: employeeListSchema })).items.map(
    (employee) => ({
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      fullName: employee.fullName,
    }),
  );
});

/** Roles an account can get (needs user:read). */
export const listRoleOptions = cache(
  async () => (await apiFetch("/roles", { schema: roleOptionsSchema })).items,
);

/** Users that could be linked to an employee (needs user:read). */
export const listUserOptions = cache(async () => {
  const params = new URLSearchParams({ pageSize: String(OPTIONS_PAGE_SIZE), sort: "name" });
  return (await apiFetch(`/users?${params}`, { schema: userOptionsSchema })).items;
});
