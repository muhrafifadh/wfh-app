import { PrismaPg } from "@prisma/adapter-pg";

/**
 * The driver adapter ignores `?schema=` in the URL, unlike `prisma migrate`. A deployment can
 * keep each service in its own schema of one database, so pass it on, for raw SQL too.
 */
export function pgAdapter(connectionString: string): PrismaPg {
  const schema = new URL(connectionString).searchParams.get("schema");
  if (!schema || schema === "public") return new PrismaPg({ connectionString });
  return new PrismaPg({ connectionString, options: `-c search_path=${schema}` }, { schema });
}
