import { neon } from "@neondatabase/serverless";

/**
 * Returns a Neon serverless SQL client bound to the connection string in
 * process.env.DATABASE_URL. The connection string is read from the
 * environment only — never hardcoded, never logged.
 *
 * Neon driver type quirks to remember from the schema milestone forward:
 * NUMERIC comes back as string, COUNT as bigint string, DATE as Date,
 * arrays as JS arrays, nulls as null. Coerce and guard every value read.
 */
export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return neon(url);
}
