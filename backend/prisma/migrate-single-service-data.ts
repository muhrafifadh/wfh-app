// One-off: copies a single-service Hadir.in database into the two service databases.
// Run after `pnpm db:deploy`, with the old app stopped, so nothing changes during the copy:
//   SOURCE_DATABASE_URL=… EMPLOYEE_DATABASE_URL=… ATTENDANCE_DATABASE_URL=… \
//     node prisma/migrate-single-service-data.ts [--dry-run]
// It only reads the source. Both targets must start empty, and are committed only once both
// copies have passed their checks. --dry-run does all of it, then rolls back.
import pg from "pg";

const LAST_SOURCE_MIGRATION = "20261102092651_require_check_in_out_evidence";

type Copy = { table: string; add?: Record<string, string>; from?: string };

/** In order of their foreign keys. A column the target lacks isn't copied, and is reported. */
const EMPLOYEE: Copy[] = [
  { table: "organizations" },
  { table: "roles" },
  { table: "users" },
  { table: "divisions" },
  { table: "employees" },
  { table: "sessions" },
  { table: "refresh_tokens" },
  { table: "password_reset_tokens" },
  { table: "user_tokens" },
  { table: "uploads" },
  { table: "audit_logs" },
];

const createdByName = (table: string): Copy => ({
  table,
  add: { created_by_name: "(select u.name from users u where u.id = t.created_by_id)" },
});

const ATTENDANCE: Copy[] = [
  { table: "organizations" },
  { table: "divisions" },
  { table: "employees" },
  createdByName("work_schedules"),
  createdByName("holidays"),
  { table: "attendances" },
  { table: "idempotency_records" },
  { table: "correction_requests" },
  { table: "correction_snapshots" },
  { table: "notifications" },
  { table: "notification_preferences" },
  { table: "attendance_verifications" },
  { table: "verification_notice_acknowledgements" },
  { table: "verification_pending_photos" },
  { table: "verification_photo_requests" },
  { table: "work_locations" },
];

/** Tables that are new in the service databases, with nothing to copy. */
const NEW_TABLES = new Set(["office_locations"]);

const need = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name}.`);
  return value;
};

const dryRun = process.argv.includes("--dry-run");
const connect = async (url: string) => {
  // Targets can be separate databases, or schemas of one database (`?schema=employee`)
  const schema = new URL(url).searchParams.get("schema") ?? "public";
  const client = new pg.Client({ connectionString: url, options: `-c search_path=${schema}` });
  await client.connect();
  return client;
};
const count = async (client: pg.Client, table: string): Promise<number> =>
  Number((await client.query(`select count(*) as n from "${table}"`)).rows[0].n);
const tablesOf = async (client: pg.Client): Promise<string[]> =>
  (
    await client.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname = current_schema() and tablename <> '_prisma_migrations'",
    )
  ).rows.map((row) => row.tablename);
const columnsOf = async (client: pg.Client, table: string): Promise<string[]> =>
  (
    await client.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema = current_schema() and table_name = $1",
      [table],
    )
  ).rows.map((row) => row.column_name);

/** Leaves the target's transaction open, for the caller to finish. */
async function copyInto(source: pg.Client, target: pg.Client, name: string, copies: Copy[]) {
  const listed = new Set(copies.map((copy) => copy.table));
  const unlisted = (await tablesOf(target)).filter(
    (table) => !listed.has(table) && !NEW_TABLES.has(table),
  );
  if (unlisted.length) throw new Error(`${name}: no rule for ${unlisted.join(", ")}`);

  await target.query("begin");
  for (const { table, add = {} } of copies) {
    if ((await count(target, table)) > 0) throw new Error(`${name}.${table} isn't empty.`);
    const targetColumns = await columnsOf(target, table);
    const sourceColumns = await columnsOf(source, table);
    const shared = sourceColumns.filter((column) => targetColumns.includes(column));
    const dropped = sourceColumns.filter((column) => !targetColumns.includes(column));
    const selects = [
      ...shared.map((column) => `t."${column}"`),
      ...Object.entries(add).map(([column, sql]) => `${sql} as "${column}"`),
    ];
    const columns = [...shared, ...Object.keys(add)].map((column) => `"${column}"`).join(", ");
    const { rows } = await source.query<{ rows: unknown }>(
      `select coalesce(json_agg(r), '[]') as rows from (select ${selects.join(", ")} from "${table}" t) r`,
    );
    // Self-references are fine: foreign keys are checked at the end of the statement
    await target.query(
      `insert into "${table}" (${columns}) select ${columns} from json_populate_recordset(null::"${table}", $1::json)`,
      [JSON.stringify(rows[0]?.rows ?? [])],
    );
    const [from, to] = [await count(source, table), await count(target, table)];
    if (from !== to) throw new Error(`${name}.${table}: ${from} rows became ${to}.`);
    console.warn(
      `${name}.${table}: ${to} rows${dropped.length ? ` (not copied: ${dropped.join(", ")})` : ""}`,
    );
  }
}

const source = await connect(need("SOURCE_DATABASE_URL"));
const employee = await connect(need("EMPLOYEE_DATABASE_URL"));
const attendance = await connect(need("ATTENDANCE_DATABASE_URL"));
try {
  await source.query("begin transaction isolation level repeatable read read only");
  const { rows } = await source.query<{ migration_name: string }>(
    "select migration_name from _prisma_migrations where finished_at is not null order by started_at desc limit 1",
  );
  if (rows[0]?.migration_name !== LAST_SOURCE_MIGRATION) {
    throw new Error(
      `Expected the source at ${LAST_SOURCE_MIGRATION}, found ${rows[0]?.migration_name}.`,
    );
  }
  const listed = new Set([...EMPLOYEE, ...ATTENDANCE].map((copy) => copy.table));
  const unlisted = (await tablesOf(source)).filter((table) => !listed.has(table));
  if (unlisted.length) throw new Error(`Source tables with no rule: ${unlisted.join(", ")}`);

  await copyInto(source, employee, "employee", EMPLOYEE);
  await copyInto(source, attendance, "attendance", ATTENDANCE);
  const finish = dryRun ? "rollback" : "commit";
  await employee.query(finish);
  await attendance.query(finish);
  console.warn(dryRun ? "Dry run: rolled back." : "Done.");
} finally {
  // Closing a connection rolls back whatever it left open
  await Promise.all([source.end(), employee.end(), attendance.end()]);
}
