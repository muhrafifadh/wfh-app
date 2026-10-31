/**
 * docs/07-database-and-prisma.md#soft-delete — spread into every `where` on a
 * soft-deleted model. Keep it inside repositories, where it can't be skipped.
 */
export const notDeleted = { deletedAt: null } as const;
