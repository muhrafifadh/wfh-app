# Playbook · Database Migration

Schema changes are the riskiest changes we ship, because the database can't be rolled back the way code can. Follow these steps for every change to `schema.prisma`.

## 1. Classify the change

| Change | Safe in one deploy? |
|---|---|
| Add a table | ✅ |
| Add a nullable column, or one with a default | ✅ |
| Add an index | ✅ on small tables. On large tables, use `CREATE INDEX CONCURRENTLY` (hand-edited SQL, see below) |
| Add a `NOT NULL` column without a default | ❌ Use expand/contract |
| Rename a column or table | ❌ Use expand/contract |
| Change a column's type | ❌ Use expand/contract |
| Drop a column or table | ❌ Stop using it in code first, drop it in a later release |
| Add a unique constraint or foreign key to existing data | ⚠️ Clean up the data first, in a separate migration |

During a deploy, the old version of the app runs alongside the new database schema for a while. **Every migration must work with both the code currently running and the new code.**

## 2. Expand / contract (for the ❌ cases)

Example: renaming `invoices.notes` → `invoices.memo`.

1. **Expand** (release 1): add `memo`, nullable. Write to both columns, read from `memo` and fall back to `notes`.
2. **Backfill** (a script or data migration, in batches): `UPDATE invoices SET memo = notes WHERE memo IS NULL`, 1,000 rows at a time.
3. **Switch** (release 2): read and write only `memo`. Add `NOT NULL` if needed.
4. **Contract** (release 3): drop `notes`.

## 3. Create the migration

```bash
pnpm db:migrate --name <snake_case_description>   # e.g. add_invoice_memo
```

- [ ] **Read the generated `migration.sql`.** Prisma sometimes drops and recreates a column where you meant to rename it, which loses the data. Fix that by hand before you commit.
- [ ] Add anything Prisma can't express: check constraints, partial indexes, `CREATE INDEX CONCURRENTLY` (put it in its own migration, because `CONCURRENTLY` can't run inside a transaction), and triggers.
- [ ] Data changes that run as part of the migration (backfills, seeding permissions) must be safe to run more than once, and should handle large tables in batches.

## 4. Test it

- [ ] `pnpm db:migrate reset` locally: all migrations apply cleanly to an empty database.
- [ ] Apply the migration to a copy of the database with realistic data. Check how long it takes and whether it locks tables.
- [ ] `pnpm test:e2e` passes.
- [ ] CI's `prisma migrate diff` check passes (the schema and migrations match).

## 5. Ship it

- [ ] The PR description starts with **"⚠️ Schema change"** and says which kind of change it is (from step 1) and any risk of locking tables.
- [ ] The migration and the code that depends on it are in the right releases (see step 2).
- [ ] The release runs `prisma migrate deploy` before the new app version starts.

## Never

- **Never edit or delete a migration that has been merged.** Write a new migration instead.
- **Never run `prisma db push` or `migrate reset` against a shared or production database.**
- **Never change the schema by hand on a shared database** without a matching migration.
- **Never merge a migration that drops data before the release that stops using it has been deployed.**

## Related

[07 Database & Prisma](../07-database-and-prisma.md) · [16 Tooling & Git](../16-tooling-and-git.md)
