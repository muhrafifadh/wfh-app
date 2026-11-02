import {
  createLoader,
  createSerializer,
  parseAsBoolean,
  parseAsInteger,
  type inferParserType,
} from "nuqs/server";

import { routes } from "@/config/routes";

// docs/11-state-and-url-params.md — the review list's URL.
export const verificationSearchParams = {
  /** Only results waiting for review. */
  flagged: parseAsBoolean.withDefault(true),
  page: parseAsInteger.withDefault(1),
};

export const loadVerificationSearchParams = createLoader(verificationSearchParams);
export type VerificationFilters = inferParserType<typeof verificationSearchParams>;

const serialize = createSerializer(verificationSearchParams);

export const verificationHref = (filters: Partial<VerificationFilters>) =>
  serialize(routes.verificationReview(), filters);
