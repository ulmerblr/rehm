import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prepareCounterpart } from "@/lib/translations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Accepting may translate the restatement, which calls the model.
export const maxDuration = 60;

// Accept the latest proposal: flip accepted + accepted_at (column-level grant).
// Locked afterwards. Scoped to the session user's own restatement.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: restatementId } = await params;
  const sql = getSql();

  const owned = (await sql`
    SELECT d.user_id,
           (SELECT count(*)::int FROM restatement_turns t
              WHERE t.restatement_id = ${restatementId} AND t.role = 'proposal') AS proposals
    FROM restatements r JOIN dreams d ON d.id = r.dream_id
    WHERE r.id = ${restatementId}
  `) as Array<{ user_id: string; proposals: number }>;
  if (owned.length === 0 || owned[0].user_id !== userId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (Number(owned[0].proposals) === 0) {
    return NextResponse.json({ error: "no proposal to accept" }, { status: 400 });
  }

  const updated = (await sql`
    UPDATE restatements SET accepted = true, accepted_at = now()
    WHERE id = ${restatementId} AND accepted = false
    RETURNING id
  `) as Array<{ id: string }>;
  if (updated.length === 0) {
    return NextResponse.json({ error: "already accepted" }, { status: 409 });
  }

  // The restatement's text is its latest proposal turn — accepting is what
  // makes it final, so this is the moment it is worth translating. Keyed to the
  // restatement, which is what the dream page renders.
  const latest = (await sql`
    SELECT body FROM restatement_turns
    WHERE restatement_id = ${restatementId} AND role = 'proposal'
    ORDER BY turn_no DESC LIMIT 1
  `) as Array<{ body: string }>;
  if (latest.length > 0) {
    await prepareCounterpart(userId, [
      { type: "restatement", id: restatementId, text: String(latest[0].body) },
    ]);
  }

  return NextResponse.json({ ok: true });
}
