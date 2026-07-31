// rehm migration runner / verifier.
//
//   npm run migrate
//
// Reads DATABASE_URL from the environment (or from .env.local / .env if
// present). Records which migrations/*.sql files are already applied (via the
// schema_migrations rows the files insert themselves) and runs the dreams
// immutability proof.
//
// Apply path: migrations are normally run in the Neon SQL editor as the OWNER
// role, because DATABASE_URL points at the app role (rehm_app), which has no
// privilege to create tables or roles. If this runner is pointed at owner
// credentials it will apply any pending files; pointed at the app role it
// simply reports status and proves immutability. Either way it never reapplies
// an already-recorded migration.
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
    "DATABASE_URL is not set. Set it, or run migrations in the Neon SQL " +
      "editor as the owner role, then re-run `npm run migrate`."
  );
  process.exit(1);
}

// Split a .sql file into statements. Aware of single-quoted strings, line and
// block comments, and dollar-quoted bodies ($$...$$ / $tag$...$tag$) so
// function/DO bodies containing semicolons stay intact.
function splitStatements(sql) {
  const statements = [];
  let current = "";
  let inSingle = false;
  let dollarTag = null;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      if (ch === "\n") {
        inLineComment = false;
        current += ch;
      }
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) {
        current += dollarTag;
        i += dollarTag.length - 1;
        dollarTag = null;
      } else {
        current += ch;
      }
      continue;
    }
    if (inSingle) {
      current += ch;
      if (ch === "'") {
        if (next === "'") {
          current += next;
          i++;
        } else {
          inSingle = false;
        }
      }
      continue;
    }

    if (ch === "-" && next === "-") {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      current += ch;
      continue;
    }
    if (ch === "$") {
      const match = /^\$[A-Za-z_0-9]*\$/.exec(sql.slice(i));
      if (match) {
        dollarTag = match[0];
        current += dollarTag;
        i += dollarTag.length - 1;
        continue;
      }
    }
    if (ch === ";") {
      if (current.trim()) statements.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

async function main() {
  const sql = neon(process.env.DATABASE_URL);

  // Bootstrap the ledger if we can (owner path). If we can't (app role), it
  // was already created by 0001 in the SQL editor.
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `;
  } catch {
    // no CREATE privilege — expected for the app role; continue.
  }

  let applied;
  try {
    applied = new Set(
      (await sql`SELECT version FROM schema_migrations`).map((r) => r.version)
    );
  } catch {
    console.error(
      "schema_migrations is not readable. Apply 0001 (and 0002) in the Neon " +
        "SQL editor as the owner role first."
    );
    process.exit(1);
  }

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const pending = files.filter((f) => !applied.has(f));
  for (const file of files) {
    if (!pending.includes(file)) console.log(`applied  ${file}`);
  }

  for (const file of pending) {
    const statements = splitStatements(
      readFileSync(join(migrationsDir, file), "utf8")
    );
    try {
      // Each file records its own schema_migrations row, so nothing is
      // appended here.
      await sql.transaction(statements.map((s) => sql.query(s)));
      console.log(`apply    ${file} (${statements.length} statements)`);
    } catch (err) {
      console.error(
        `\nCould not apply ${file}: ${err.message}\n` +
          "Migrations must be run in the Neon SQL editor as the owner role " +
          "(the app role cannot create tables or roles)."
      );
      process.exit(1);
    }
  }

  console.log(
    pending.length === 0
      ? "All migrations recorded."
      : `Applied ${pending.length} migration(s).`
  );

  await proveImmutability(sql);
}

// Proves, as whatever role DATABASE_URL uses, the append-only model.
// Meaningful only when run as the app role (rehm_app) over a real connection:
// point DATABASE_URL at rehm_app (do NOT use SET ROLE from the owner — that
// skips the real connection/password path). WHERE false guarantees no row is
// ever touched even if a check were absent.
async function proveImmutability(sql) {
  // Role hardening check (correction #1). A SQL-created role must not be a
  // superuser, must not bypass RLS, and must not be a member of neon_superuser
  // (which could reach tables it does not own and void the separation).
  console.log("\n--- rehm_app role hardening ---");
  try {
    const [role] = await sql`
      SELECT r.rolname, r.rolsuper, r.rolbypassrls,
             ARRAY(SELECT g.rolname FROM pg_auth_members m
                   JOIN pg_roles g ON g.oid = m.roleid
                   WHERE m.member = r.oid) AS memberof
      FROM pg_roles r WHERE r.rolname = 'rehm_app'
    `;
    if (!role) {
      console.log("WARN  rehm_app not found — apply 0002 as the owner first.");
    } else {
      const memberof = role.memberof ?? [];
      console.log(
        `      rolname=${role.rolname} rolsuper=${role.rolsuper} ` +
          `rolbypassrls=${role.rolbypassrls} memberof={${memberof.join(", ")}}`
      );
      if (role.rolsuper || role.rolbypassrls || memberof.includes("neon_superuser")) {
        console.log(
          "FAIL  rehm_app is over-privileged (superuser / bypassrls / " +
            "neon_superuser). Immutability guarantee is void — revoke and re-run."
        );
        process.exitCode = 1;
      } else {
        console.log("OK    rehm_app is not superuser, no bypassrls, no neon_superuser.");
      }
    }
  } catch (err) {
    console.log(`WARN  could not read role metadata: ${err.message}`);
  }

  // Writes that must be REJECTED.
  console.log("\n--- writes that must be rejected ---");
  const rejected = [
    ["UPDATE dreams", "UPDATE dreams SET capture_method = capture_method WHERE false"],
    ["DELETE dreams", "DELETE FROM dreams WHERE false"],
    ["self-GRANT dreams", "GRANT UPDATE ON dreams TO CURRENT_USER"],
    ["UPDATE analyses", "UPDATE analyses SET body = body WHERE false"],
  ];
  for (const [label, stmt] of rejected) {
    try {
      await sql.query(stmt);
      console.log(`FAIL  ${label} was ALLOWED — append-only model is not in effect.`);
      process.exitCode = 1;
    } catch (err) {
      console.log(`OK    ${label} rejected: ${err.message}`);
    }
  }

  // INSERT into analyses must be ALLOWED. A random dream_id can't satisfy the
  // FK, so this trips a foreign_key_violation *after* the privilege check —
  // which proves INSERT is permitted without committing a junk row (dreams is
  // immutable, so a real test row could never be cleaned up).
  console.log("\n--- write that must be allowed ---");
  try {
    await sql.query(
      "INSERT INTO analyses (dream_id, model, prompt_version, blind) " +
        "VALUES (gen_random_uuid(), 'immutability-proof', 'immutability-proof', true)"
    );
    console.log("OK    INSERT into analyses committed (permitted).");
  } catch (err) {
    const denied =
      err.code === "42501" || /permission denied/i.test(err.message);
    if (denied) {
      console.log(`FAIL  INSERT into analyses denied: ${err.message}`);
      process.exitCode = 1;
    } else {
      console.log(
        `OK    INSERT into analyses permitted (reached constraint check, ` +
          `not blocked by privilege): ${err.message}`
      );
    }
  }
}

main().catch((err) => {
  console.error("migrate failed:", err.message);
  process.exit(1);
});
