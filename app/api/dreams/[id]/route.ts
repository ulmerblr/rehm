import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Hard-delete a dream and everything derived from it. This is the ONLY path
// that may destroy immutable rows: it opts in per-transaction via
// SET LOCAL rehm.allow_delete = 'on' (see migration 0008), which the trigger
// guard requires. Outside this transaction the corpus stays append-only.
//
// Cascade order respects the foreign keys (children before dreams). taggings,
// analyses, and trend_claims already allow DELETE; restatement_turns,
// restatements, and dreams pass only because the flag is set. trend_runs are
// never removed — a dream is only scrubbed from any trend_claims that cite it.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: dreamId } = await params;
  if (!UUID_RE.test(dreamId)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const sql = getSql();

  // Confirm ownership before destroying anything. dreams.user_id is immutable,
  // so a dream that is this user's stays this user's for the delete below.
  const owned = (await sql`
    SELECT 1 FROM dreams WHERE id = ${dreamId} AND user_id = ${userId}
  `) as Array<unknown>;
  if (owned.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    await sql.transaction([
      // Opt in to deletion for this transaction only (0008 guard). set_config
      // with is_local=true is transaction-scoped, like SET LOCAL, but rides as
      // an ordinary SELECT so it propagates reliably through the Neon HTTP
      // transaction batch.
      sql`SELECT set_config('rehm.allow_delete', 'on', true)`,
      // Children first (FKs to dreams are RESTRICT, not CASCADE).
      sql`DELETE FROM taggings WHERE dream_id = ${dreamId}`,
      sql`DELETE FROM trend_claims WHERE ${dreamId}::uuid = ANY (dream_ids)`,
      sql`DELETE FROM analyses WHERE dream_id = ${dreamId}`,
      sql`DELETE FROM restatement_turns
          WHERE restatement_id IN (SELECT id FROM restatements WHERE dream_id = ${dreamId})`,
      sql`DELETE FROM restatements WHERE dream_id = ${dreamId}`,
      // The immutable primary record, last, still scoped to the owner.
      sql`DELETE FROM dreams WHERE id = ${dreamId} AND user_id = ${userId}`,
    ]);
  } catch (err) {
    // Surface the real Postgres error so a failed delete is diagnosable (e.g.
    // "migration 0008 not applied" vs. an unexpected constraint). Single-user
    // app; the message is a DB error string, not user data.
    return NextResponse.json(
      { error: "server", message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
