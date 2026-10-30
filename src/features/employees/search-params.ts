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
import { EMPLOYEE_SORT_FIELDS, EMPLOYEE_STATUSES } from "@/features/employees/constants";

// docs/11-state-and-url-params.md — the one definition of the employees list's URL.
export const employeeSearchParams = {
  q: parseAsString.withDefault(""),
  status: parseAsStringLiteral(EMPLOYEE_STATUSES),
  divisionId: parseAsString,
  managerId: parseAsString,
  sort: parseAsStringLiteral(EMPLOYEE_SORT_FIELDS).withDefault("employeeNumber"),
  order: parseAsStringLiteral(SORT_ORDERS).withDefault("asc"),
  page: parseAsInteger.withDefault(1),
};

export const loadEmployeeSearchParams = createLoader(employeeSearchParams);
export type EmployeeFilters = inferParserType<typeof employeeSearchParams>;

const serialize = createSerializer(employeeSearchParams);

/** A link to the employees list with these filters. Defaults are left out of the URL. */
export const employeeListHref = (filters: Partial<EmployeeFilters>) =>
  serialize(routes.employees(), filters);
