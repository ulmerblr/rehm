import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Accept the current (latest) proposal: flip accepted + accepted_at. Uses the
// column-level UPDATE grant on restatements. Locked afterwards — no further
// proposals. Requires at least one proposal turn to exist.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: restatementId } = await params;
  const sql = getSql();

  const [proposalCount] = (await sql`
    SELECT count(*)::int AS n FROM restatement_turns
    WHERE restatement_id = ${restatementId} AND role = 'proposal'
  `) as Array<{ n: number }>;
  if (Number(proposalCount.n) === 0) {
    return NextResponse.json({ error: "no proposal to accept" }, { status: 400 });
  }

  const updated = (await sql`
    UPDATE restatements
    SET accepted = true, accepted_at = now()
    WHERE id = ${restatementId} AND accepted = false
    RETURNING id
  `) as Array<{ id: string }>;
  if (updated.length === 0) {
    return NextResponse.json({ error: "already accepted or not found" }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
