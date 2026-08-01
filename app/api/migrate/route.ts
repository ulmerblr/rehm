import { NextRequest, NextResponse } from "next/server";
import { SIGNUP_CODE } from "@/lib/config";
import { SESSION_COOKIE, verifySession, timingSafeEqualStr } from "@/lib/auth";
import { ensureMigrated } from "@/lib/migrate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Migrations apply automatically at server startup (instrumentation.ts). This
// endpoint is only a manual fallback: the Settings "Apply pending migrations"
// button posts here (authenticated by session), and the committed-code URL
// still works for a plain browser hit. Both share lib/migrate, so there is one
// migration code path, not two.
async function run(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const code = new URL(req.url).searchParams.get("code") ?? "";
  const authed = Boolean(session) || timingSafeEqualStr(code, SIGNUP_CODE);
  if (!authed) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
