import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Erase another account and everything derived from it.
 *
 * Owner only, and never the owner themselves: an instance with no owner has no
 * way back, and there is no admin console to fix it from.
 *
 * The order below is the foreign-key order, children first. Two flags are
 * opted into for this transaction: rehm.allow_delete for the dream-side
 * immutables (0008) and rehm.allow_account_delete for the trend runs and the
 * spend ledger (0021). They are separate so the ordinary dream-delete path,
 * which sets only the first, still cannot reach either of those.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actorId = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!actorId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: targetId } = await params;
  if (!UUID_RE.test(targetId)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const sql = getSql();

  const actor = (await sql`
    SELECT role FROM users WHERE id = ${actorId}
  `) as Array<{ role: string }>;
  if (actor.length === 0 || actor[0].role !== "owner") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (targetId === actorId) {
    return NextResponse.json(
      {
        error: "self",
        message: "You can't delete the owner account — nothing could administer this instance afterwards.",
      },
      { status: 400 }
    );
  }

  const target = (await sql`
    SELECT email, role FROM users WHERE id = ${targetId}
  `) as Array<{ email: string; role: string }>;
  if (target.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (target[0].role === "owner") {
    return NextResponse.json(
      { error: "owner", message: "That account is an owner." },
      { status: 400 }
    );
  }

  try {
    await sql.transaction([
      // Both flags, transaction-scoped. set_config with is_local rides as an
      // ordinary SELECT so it propagates through the Neon HTTP batch.
      sql`SELECT set_config('rehm.allow_delete', 'on', true)`,
      sql`SELECT set_config('rehm.allow_account_delete', 'on', true)`,

      // Derived text first — it points at six tables by loose reference, so
      // nothing cascades it.
      sql`DELETE FROM translations WHERE user_id = ${targetId}`,
      sql`DELETE FROM translation_jobs WHERE user_id = ${targetId}`,
      // trend_job_batches cascade from trend_jobs.
      sql`DELETE FROM trend_jobs WHERE user_id = ${targetId}`,

      // Dream-side children, before the dreams they hang off.
      sql`DELETE FROM taggings
          WHERE dream_id IN (SELECT id FROM dreams WHERE user_id = ${targetId})`,
      sql`DELETE FROM analyses
          WHERE dream_id IN (SELECT id FROM dreams WHERE user_id = ${targetId})`,
      sql`DELETE FROM restatement_turns
          WHERE restatement_id IN (
            SELECT r.id FROM restatements r
            JOIN dreams d ON d.id = r.dream_id
            WHERE d.user_id = ${targetId})`,
      sql`DELETE FROM restatements
          WHERE dream_id IN (SELECT id FROM dreams WHERE user_id = ${targetId})`,
      // dream_titles and dream_addenda cascade from dreams.
      sql`DELETE FROM dreams WHERE user_id = ${targetId}`,

      // trend_claims cascade from trend_runs.
      sql`DELETE FROM trend_runs WHERE user_id = ${targetId}`,
      sql`DELETE FROM tagging_runs WHERE user_id = ${targetId}`,
      sql`DELETE FROM concepts WHERE user_id = ${targetId}`,

      sql`DELETE FROM usage_events WHERE user_id = ${targetId}`,
      sql`DELETE FROM user_api_keys WHERE user_id = ${targetId}`,

      // Invitations this account issued go with it. The one it redeemed is
      // released instead: the signup it paid for no longer exists, so holding
      // the code spent would quietly cost an invitation for nothing.
      sql`DELETE FROM invites WHERE created_by = ${targetId}`,
      sql`UPDATE invites SET used_at = NULL, used_by = NULL WHERE used_by = ${targetId}`,

      sql`DELETE FROM users WHERE id = ${targetId}`,
    ]);
  } catch (err) {
    // Surface the real Postgres error. A missed foreign key here is a bug in
    // the order above, and the message is the only way to find which one.
    return NextResponse.json(
      { error: "server", message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, email: target[0].email });
}
