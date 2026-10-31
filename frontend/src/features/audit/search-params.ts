import {
  createLoader,
  createSerializer,
  parseAsInteger,
  parseAsStringLiteral,
  type inferParserType,
} from "nuqs/server";

import { routes } from "@/config/routes";
import { AUDIT_ACTIONS } from "@/features/audit/constants";

// docs/11-state-and-url-params.md — the audit log's URL.
export const auditSearchParams = {
  action: parseAsStringLiteral(AUDIT_ACTIONS),
  page: parseAsInteger.withDefault(1),
};

export const loadAuditSearchParams = createLoader(auditSearchParams);
export type AuditFilters = inferParserType<typeof auditSearchParams>;

const serialize = createSerializer(auditSearchParams);
export const auditListHref = (filters: Partial<AuditFilters>) =>
  serialize(routes.auditLog(), filters);
