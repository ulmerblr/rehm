import { NextRequest, NextResponse } from "next/server";
import { SIGNUP_CODE } from "@/lib/config";
import { getSql } from "@/lib/db";
import { SESSION_COOKIE, verifySession, timingSafeEqualStr } from "@/lib/auth";
import { ensureMigrated } from "@/lib/migrate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Is this account the one that administers the instance?
 *
 * Fails OPEN on a missing role column, and that is deliberate: `role` arrives
 * in 0021, so an instance without it is one that needs migrating, and there is
 * no owner recorded yet to ask. Refusing there would lock the only door out.
 */
async function isOwner(userId: string): Promise<boolean> {
  try {
    const rows = (await getSql()`SELECT role FROM users WHERE id = ${userId}`) as Array<{
      role: string;
    }>;
    return rows.length > 0 && rows[0].role === "owner";
  } catch {
    return true;
  }
}

// Migrations apply automatically at server startup (instrumentation.ts). This
// endpoint is only a manual fallback: the Settings "Apply pending migrations"
// button posts here, and the committed-code URL still works for a plain
// browser hit. Both share lib/migrate, so there is one migration code path.
//
// Owner only. Schema changes are instance-wide — a member running them would
// be altering everyone's database, and the Settings button that posts here is
// not shown to them either.
async function run(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const code = new URL(req.url).searchParams.get("code") ?? "";
  const authed = (session ? await isOwner(session) : false) || timingSafeEqualStr(code, SIGNUP_CODE);
  if (!authed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const result = await ensureMigrated();
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export const POST = run;
export const GET = run;
