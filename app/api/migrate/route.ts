import { NextRequest, NextResponse } from "next/server";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";
import { SIGNUP_CODE } from "@/lib/config";
import { timingSafeEqualStr } from "@/lib/auth";
import { splitStatements } from "@/scripts/_shared.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TEMPORARY migration endpoint. Connects as the OWNER (OWNER_DATABASE_URL —
// NOT the app's DATABASE_URL) and applies any pending migrations/*.sql in
// order, tracked in schema_migrations, dollar-quote aware (same logic as the
// Node runner). Gated by the committed signup code so it's one URL to hit.
// Delete this route once 0006 has applied.
async function run(req: NextRequest) {
  const code = new URL(req.url).searchParams.get("code") ?? "";
  if (!timingSafeEqualStr(code, SIGNUP_CODE)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ownerUrl = process.env.OWNER_DATABASE_URL;
  if (!ownerUrl) {
    return NextResponse.json(
      { error: "OWNER_DATABASE_URL is not set" },
      { status: 500 }
    );
  }

  const sql = neon(ownerUrl);
  try {
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

    const appliedNow: string[] = [];
    for (const file of pending) {
      // Each file records its own schema_migrations row (last statement), so
      // running its statements atomically is all that's needed.
      const statements = splitStatements(readFileSync(join(dir, file), "utf8"));
      await sql.transaction(statements.map((s: string) => sql.query(s)));
      appliedNow.push(file);
    }

    return NextResponse.json({
      ok: true,
      alreadyApplied: files.filter((f) => applied.has(f)),
      applied: appliedNow,
    });
  } catch (err) {
    // Return the database error verbatim so it can be acted on.
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export const POST = run;
// GET too, so the URL can be opened in a browser.
export const GET = run;
