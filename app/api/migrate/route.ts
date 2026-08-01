import { NextRequest, NextResponse } from "next/server";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";
import { SIGNUP_CODE } from "@/lib/config";
import { timingSafeEqualStr } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { splitStatements } from "@/scripts/_shared.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TEMPORARY migration endpoint. Connects as the OWNER — OWNER_DATABASE_URL if
// set, otherwise POSTGRES_URL (the Neon Vercel integration's owner connection).
// Applies pending migrations/*.sql in order, tracked in schema_migrations,
// dollar-quote aware (same logic as the Node runner). Gated by the committed
// signup code. Reports a per-file result (ok / error) for EVERY pending file it
// attempts, so a failure shows exactly which file broke and why — not just the
// first error with no context. Also reports which role the APP connects as, so
// you can see whether role separation is actually in effect. Delete this route
// once 0007 has applied.
async function run(req: NextRequest) {
  const code = new URL(req.url).searchParams.get("code") ?? "";
  if (!timingSafeEqualStr(code, SIGNUP_CODE)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ownerUrl = process.env.OWNER_DATABASE_URL ?? process.env.POSTGRES_URL;
  const ownerVia = process.env.OWNER_DATABASE_URL
    ? "OWNER_DATABASE_URL"
    : process.env.POSTGRES_URL
      ? "POSTGRES_URL"
      : null;
  if (!ownerUrl) {
    return NextResponse.json(
      { error: "Neither OWNER_DATABASE_URL nor POSTGRES_URL is set" },
      { status: 500 }
    );
  }

  // Diagnostics: what role does the app run as, and via which env var?
  const appVia = process.env.DATABASE_URL
    ? "DATABASE_URL"
    : process.env.POSTGRES_URL
      ? "POSTGRES_URL"
      : "none";
  let appRole: string | null = null;
  try {
    const [row] = (await getSql()`SELECT current_user`) as Array<{ current_user: string }>;
    appRole = row.current_user;
  } catch {
    appRole = null;
  }

  const sql = neon(ownerUrl);
  try {
    const [{ current_user: ownerRole }] = (await sql`SELECT current_user`) as Array<{
      current_user: string;
    }>;

    await sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `;
    const applied = new Set(
      ((await sql`SELECT version FROM schema_migrations`) as Array<{ version: string }>).map(
        (r) => r.version
      )
    );

    const dir = join(process.cwd(), "migrations");
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    const pending = files.filter((f) => !applied.has(f));

    // Apply each pending file as its own transaction. Record a result for every
    // file attempted. Migrations are ordered and interdependent, so on the first
    // failure we stop — but we still return the full results array (successes
    // before it, and the failing file with its exact error).
    const results: Array<{ file: string; ok: boolean; error?: string }> = [];
    for (const file of pending) {
      try {
        const statements = splitStatements(readFileSync(join(dir, file), "utf8"));
        await sql.transaction(statements.map((s: string) => sql.query(s)));
        results.push({ file, ok: true });
      } catch (err) {
        results.push({
          file,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
        break;
      }
    }

    const ok = results.every((r) => r.ok);
    return NextResponse.json(
      {
        ok,
        results,
        pending: pending.length,
        alreadyApplied: files.filter((f) => applied.has(f)),
        diagnostics: { ownerVia, ownerRole, appVia, appRole },
      },
      { status: ok ? 200 : 500 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        diagnostics: { ownerVia, appVia, appRole },
      },
      { status: 500 }
    );
  }
}

export const POST = run;
export const GET = run;
