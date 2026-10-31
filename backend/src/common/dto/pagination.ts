import { z } from "zod";

// docs/05-api-design.md#lists-pagination-filtering-sorting
export const MAX_PAGE_SIZE = 100;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const paginated = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    page: z.int(),
    pageSize: z.int(),
    total: z.int(),
  });

export type Paginated<T> = { items: T[]; page: number; pageSize: number; total: number };

/** Prisma skip/take for a page. */
export const pageWindow = ({ page, pageSize }: PaginationQuery) => ({
  skip: (page - 1) * pageSize,
  take: pageSize,
});

/**
 * "sort" query values: a field, or "-field" for descending.
 * Returns the allowed values for a z.enum().
 */
export const sortValues = <const F extends string>(fields: readonly F[]) =>
  [...fields, ...fields.map((f) => `-${f}` as const)] as [F | `-${F}`, ...(F | `-${F}`)[]];

/** "-createdAt" → { field: "createdAt", direction: "desc" } */
export const parseSort = <F extends string>(sort: F | `-${F}`) =>
  sort.startsWith("-")
    ? { field: sort.slice(1) as F, direction: "desc" as const }
    : { field: sort as F, direction: "asc" as const };
