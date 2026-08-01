import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getSql } from "@/lib/db";
import { splitStatements } from "@/scripts/_shared.mjs";

// Automatic, self-applying migrations. The app connects as the database owner,
// so it has the rights to migrate itself — there is no reason to make a human
// hit a URL after every deploy. ensureMigrated() runs the pending files once
// per server instance (invoked from instrumentation.ts at boot, so a fresh
// deploy is migrated before it serves its first request), and the Settings
// "Apply pending migrations" button calls the same path as a break-glass.

// Stable 64-bit key for the migration advisory lock. Any constant works as long
// as it never changes across deploys.
const MIGRATION_LOCK_KEY = 4917283006;

// Injected filenames must be inert: digits + lowercase word chars only.
const SAFE_FILENAME = /^[0-9]{4}_[a-z0-9_]+\.sql$/;
const ALREADY_APPLIED = "rehm_migration_already_applied";

export type FileResult = { file: string; ok: boolean; skipped?: boolean; error?: string };
export type MigrateResult = {
  ok: boolean;
  results: FileResult[];
  alreadyApplied: string[];
  pending: number;
};

let cached: Promise<MigrateResult> | null = null;

// Run pending migrations at most once per instance; memoize the result. If the
// run throws (e.g. a transient connection error) the memo is cleared so a later
// call — the next boot, or the Settings button — retries from scratch.
export function ensureMigrated(): Promise<MigrateResult> {
  if (!cached) {
    cached = applyPending()
      .then((result) => {
        // Only memoize a fully successful run. If a migration failed, clear the
        // memo so the next request (or the Settings button, or the next deploy)
        // retries it instead of serving the failure forever.
        if (!result.ok) cached = null;
        return result;
      })
      .catch((err) => {
        cached = null;
        throw err;
      });
  }
  return cached;
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function applyPending(): Promise<MigrateResult> {
  const sql = getSql();

  // The ledger the whole scheme keys on. Created outside the per-file
  // transactions so an empty database can bootstrap.
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  const dir = join(process.cwd(), "migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const applied = new Set(
    ((await sql`SELECT version FROM schema_migrations`) as Array<{ version: string }>).map(
      (r) => r.version
    )
  );
  const pending = files.filter((f) => !applied.has(f));
  if (pending.length === 0) {
    return { ok: true, results: [], alreadyApplied: files, pending: 0 };
  }

  const results: FileResult[] = [];
  for (const file of pending) {
    if (!SAFE_FILENAME.test(file)) {
      results.push({ file, ok: false, error: "unsafe migration filename" });
      break;
    }
    const statements = splitStatements(readFileSync(join(dir, file), "utf8"));
    // Apply the file in ONE transaction that first takes a global advisory lock
    // (so two instances booting at once serialize instead of racing the DDL),
    // then aborts cleanly if the version was applied by whoever held the lock
    // before us. A clean abort rolls the transaction back, so no DDL runs twice.
    const guarded = [
      sql.query(`SELECT pg_advisory_xact_lock(${MIGRATION_LOCK_KEY})`),
      sql.query(
        `DO $$ BEGIN
           IF EXISTS (SELECT 1 FROM schema_migrations WHERE version = '${file}') THEN
             RAISE EXCEPTION '${ALREADY_APPLIED}';
           END IF;
         END $$`
      ),
      ...statements.map((s: string) => sql.query(s)),
    ];
    try {
      await sql.transaction(guarded);
      results.push({ file, ok: true });
    } catch (err) {
      const m = msg(err);
      if (m.includes(ALREADY_APPLIED)) {
        // Another instance applied it while we waited on the lock — not an error.
        results.push({ file, ok: true, skipped: true });
        continue;
      }
      // Real failure: stop (later files may depend on this one) and report it.
      results.push({ file, ok: false, error: m });
      break;
    }
  }

  return {
    ok: results.every((r) => r.ok),
    results,
    alreadyApplied: files.filter((f) => applied.has(f)),
    pending: pending.length,
  };
}
