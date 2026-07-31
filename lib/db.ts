import { neon } from "@neondatabase/serverless";

let warnedFallback = false;

/**
 * Returns a Neon serverless SQL client for the app runtime. Reads
 * DATABASE_URL (the rehm_app app-role connection); if unset, falls back to
 * POSTGRES_URL (set by the Neon Vercel integration). The connection string is
 * read from the environment only — never hardcoded, never logged.
 *
 * WARNING: POSTGRES_URL from the Neon integration is typically the OWNER role,
 * which can UPDATE/DELETE and would bypass the append-only guarantees. Set
 * DATABASE_URL to the rehm_app connection string in production.
 */
export function getSql() {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) {
    throw new Error("Neither DATABASE_URL nor POSTGRES_URL is set");
  }
  if (!process.env.DATABASE_URL && !warnedFallback) {
    warnedFallback = true;
    console.warn(
      "[rehm] DATABASE_URL not set — falling back to POSTGRES_URL. Set " +
        "DATABASE_URL to the rehm_app connection string; POSTGRES_URL is likely " +
        "the owner role and would bypass the append-only guarantees."
    );
  }
  return neon(url);
}
