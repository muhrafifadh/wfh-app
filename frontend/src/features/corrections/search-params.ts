import {
  createLoader,
  createSerializer,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  type inferParserType,
} from "nuqs/server";

import { routes } from "@/config/routes";
import { CORRECTION_STATUSES } from "@/features/corrections/constants";

// docs/11-state-and-url-params.md — the corrections lists' URLs.

/** My corrections: every status unless one is chosen. */
export const myCorrectionsSearchParams = {
  status: parseAsStringLiteral(CORRECTION_STATUSES),
  page: parseAsInteger.withDefault(1),
};
export const loadMyCorrectionsSearchParams = createLoader(myCorrectionsSearchParams);
export type MyCorrectionsFilters = inferParserType<typeof myCorrectionsSearchParams>;
const serializeMine = createSerializer(myCorrectionsSearchParams);
export const myCorrectionsHref = (filters: Partial<MyCorrectionsFilters>) =>
  serializeMine(routes.corrections(), filters);

/** The review queue: pending (oldest first) unless another status is chosen. */
export const reviewSearchParams = {
  status: parseAsStringLiteral(CORRECTION_STATUSES).withDefault("pending"),
  employeeId: parseAsString,
  divisionId: parseAsString,
  page: parseAsInteger.withDefault(1),
};
export const loadReviewSearchParams = createLoader(reviewSearchParams);
export type ReviewFilters = inferParserType<typeof reviewSearchParams>;
const serializeReview = createSerializer(reviewSearchParams);
export const reviewHref = (filters: Partial<ReviewFilters>) =>
  serializeReview(routes.correctionReview(), filters);
