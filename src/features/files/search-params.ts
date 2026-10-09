import {
  createLoader,
  createSerializer,
  parseAsInteger,
  parseAsString,
  type inferParserType,
} from "nuqs/server";

import { routes } from "@/config/routes";

// docs/11-state-and-url-params.md — the files list's URL.
export const fileSearchParams = {
  q: parseAsString.withDefault(""),
  page: parseAsInteger.withDefault(1),
};

export const loadFileSearchParams = createLoader(fileSearchParams);
export type FileFilters = inferParserType<typeof fileSearchParams>;

const serialize = createSerializer(fileSearchParams);
export const fileListHref = (filters: Partial<FileFilters>) => serialize(routes.files(), filters);
