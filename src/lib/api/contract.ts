import type { errorBodySchema } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";

import type { z } from "zod";

/**
 * Types generated from the backend's openapi.json (`pnpm api:types`).
 * Use these to check hand-written Zod schemas against the real API: when the
 * backend changes a shape, `pnpm typecheck` fails until the schema is updated.
 */
export type ApiSchema<Name extends keyof components["schemas"]> = components["schemas"][Name];

/** Compile-time "these two types are identical" (fails on extra, missing or different fields). */
export type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
export type Expect<T extends true> = T;

// The shared error body
export type _ErrorBody = Expect<
  Equal<z.output<typeof errorBodySchema>, ApiSchema<"ErrorResponse">>
>;
