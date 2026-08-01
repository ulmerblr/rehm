import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Put another account's calls on your key, or take them off it again.
 *
 * You can only ever offer your own key — the body says on or off, never whose,
 * so there is no request shape that bills a third party. Owner-only for now
 * because the owner is the only account that can see the roster to pick from;
 * the column itself (0023) does not care who sponsors whom.
 *
 * Turning it ON requires an active key on the sponsor's own account. Offering
 * to pay with a key you don't have would leave the other person with an app
 * that silently generates nothing, which is the exact confusion this feature
 * exists to remove.
 *
 * Turning it OFF is always allowed and takes effect on the next call. Nothing
 * already generated is affected — the spend is on the ledger either way.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actorId = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!actorId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: targetId } = await params;
  if (!UUID_RE.test(targetId)) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const sponsor = body?.sponsor === true;

  const sql = getSql();

  const actor = (await sql`SELECT role FROM users WHERE id = ${actorId}`) as Array<{
    role: string;
  }>;
  if (actor.length === 0 || actor[0].role !== "owner") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (targetId === actorId) {
    return NextResponse.json(
      { error: "self", message: "Your own calls already use your own key." },
      { status: 400 }
    );
  }

  const target = (await sql`SELECT email FROM users WHERE id = ${targetId}`) as Array<{
    email: string;
  }>;
  if (target.length === 0) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (sponsor) {
    const [{ n }] = (await sql`
      SELECT count(*)::int AS n FROM user_api_keys
      WHERE user_id = ${actorId} AND status = 'active'
    `) as Array<{ n: number }>;
    if (n === 0) {
      return NextResponse.json(
        {
          error: "no_key",
          message: "Add your own API key first — there is nothing to bill their calls to yet.",
        },
        { status: 400 }
      );
    }
  }

  await sql`
    UPDATE users SET key_sponsor_id = ${sponsor ? actorId : null}
    WHERE id = ${targetId}
  `;

  return NextResponse.json({ ok: true, sponsored: sponsor, email: target[0].email });
}
