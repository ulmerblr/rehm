// rehm migration runner.
//
//   npm run migrate
//
// Reads DATABASE_URL from the environment (or from .env.local / .env if
// present — e.g. after `vercel env pull .env.local`). Applies every
// migrations/*.sql file that has not yet been recorded in schema_migrations,
// each atomically, in filename order. Idempotent: already-applied files are
// skipped. After applying, it runs the dreams immutability proof.
//
// Never prints the connection string.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { neon } from "@neondatabase/serverless";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const migrationsDir = join(repoRoot, "migrations");

// Minimal .env loader so `vercel env pull .env.local && npm run migrate` works
// without adding a dotenv dependency.
function loadEnvFile(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

if (!process.env.DATABASE_URL) {
  loadEnvFile(join(repoRoot, ".env.local"));
  loadEnvFile(join(repoRoot, ".env"));
}

if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL is not set. Run `vercel env pull .env.local` first, " +
      "or export DATABASE_URL, then re-run `npm run migrate`."
  );
  process.exit(1);
}

// Split a .sql file into individual statements. The migration SQL uses no
// dollar-quoting or semicolons inside string literals, so stripping line
// comments and splitting on ';' is safe here.
function splitStatements(sql) {
  return sql
    .split("\n")
    .map((line) => {
      const c = line.indexOf("--");
      return c === -1 ? line : line.slice(0, c);
    })
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function main() {
  const sql = neon(process.env.DATABASE_URL);

  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  const applied = new Set(
    (await sql`SELECT version FROM schema_migrations`).map((r) => r.version)
  );

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip   ${file} (already applied)`);
      continue;
    }
    const statements = splitStatements(
      readFileSync(join(migrationsDir, file), "utf8")
    );
    // Apply all statements of a file plus the tracking insert atomically.
    await sql.transaction([
      ...statements.map((s) => sql.query(s)),
      sql`INSERT INTO schema_migrations (version) VALUES (${file})`,
    ]);
    console.log(`apply  ${file} (${statements.length} statements)`);
    count += 1;
  }

  console.log(count === 0 ? "Nothing to apply." : `Applied ${count} migration(s).`);

  await proveImmutability(sql);
}

// Confirms the DB rejects writes to dreams. WHERE false guarantees no row is
// ever touched even if the permission check were somehow absent — the
// permission check fires before row evaluation, so this throws regardless.
async function proveImmutability(sql) {
  console.log("\n--- dreams immutability proof ---");
  for (const op of ["UPDATE", "DELETE"]) {
    const stmt =
      op === "UPDATE"
        ? "UPDATE dreams SET capture_method = capture_method WHERE false"
        : "DELETE FROM dreams WHERE false";
    try {
      await sql.query(stmt);
      console.log(`FAIL  ${op} on dreams was ALLOWED — revoke did not take.`);
      process.exitCode = 1;
    } catch (err) {
      console.log(`OK    ${op} on dreams rejected: ${err.message}`);
    }
  }
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
