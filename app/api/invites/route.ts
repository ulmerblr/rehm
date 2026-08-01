import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { generateInviteCode } from "@/lib/invites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Issue a single-use invitation. Any signed-in user can invite; the code is
// generated server-side so a caller can't choose a weak one.
export async function POST(req: NextRequest) {
  const userId = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { label?: string };
  const label = String(body.label ?? "").trim().slice(0, 60) || null;

  const sql = getSql();

  // Retry on the astronomically unlikely collision rather than 500.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode();
    try {
      const [row] = (await sql`
        INSERT INTO invites (code, created_by, label)
        VALUES (${code}, ${userId}, ${label})
        RETURNING id, code, created_at
      `) as Array<Record<string, unknown>>;
      return NextResponse.json({ id: String(row.id), code: String(row.code) });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/invites_code_uniq|duplicate key/i.test(msg)) continue;
      if (/does not exist/i.test(msg)) {
        return NextResponse.json(
          { error: "schema", message: "Invitations aren't set up yet. Reload and try again." },
          { status: 503 }
        );
      }
      throw err;
    }
  }
  return NextResponse.json({ error: "collision" }, { status: 500 });
}
