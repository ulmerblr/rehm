// Shared helpers for the rehm migration runner (migrate.mjs) and verifier
// (verify.mjs). There is one DATABASE_URL but two identities: applying needs
// the owner role; the proof needs rehm_app. Each entry point asserts it is
// running as the right one. Never prints the connection string.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { neon } from "@neondatabase/serverless";

export const APP_ROLE = "rehm_app";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const repoRoot = join(__dirname, "..");
export const migrationsDir = join(repoRoot, "migrations");

// Minimal .env loader so `vercel env pull .env.local && npm run ...` works
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

export function makeSql() {
  if (!process.env.DATABASE_URL) {
    loadEnvFile(join(repoRoot, ".env.local"));
    loadEnvFile(join(repoRoot, ".env"));
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  return neon(process.env.DATABASE_URL);
}

// Reads the connected role and the pinned owner (null if not yet pinned).
export async function readIdentity(sql) {
  const [{ current_user: currentUser }] = await sql`SELECT current_user`;
  let pinnedOwner = null;
  try {
    const rows = await sql`SELECT owner_role FROM migration_owner LIMIT 1`;
    pinnedOwner = rows[0]?.owner_role ?? null;
  } catch {
    // migration_owner not created yet (before 0001) or not readable.
  }
  return { currentUser, pinnedOwner };
}

// Split a .sql file into statements. Aware of single-quoted strings, line and
// block comments, and dollar-quoted bodies ($$...$$ / $tag$...$tag$) so
// function/DO bodies containing semicolons stay intact.
export function splitStatements(sql) {
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

export function migrationFiles() {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

export function readMigration(file) {
  return readFileSync(join(migrationsDir, file), "utf8");
}
