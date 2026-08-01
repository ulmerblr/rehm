import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Cancel an unused invitation while keeping the record that it existed. Only
// an unused one can be revoked — once someone has signed up with it, that
// stands; use DELETE if the row itself is no longer wanted.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "not found" }, { status: 404 });

  const rows = (await getSql()`
    UPDATE invites SET revoked_at = now()
    WHERE id = ${id} AND created_by = ${userId} AND used_at IS NULL AND revoked_at IS NULL
    RETURNING id
  `) as Array<unknown>;

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "not_open", message: "That invitation is already used or revoked." },
      { status: 409 }
    );
  }
  return NextResponse.json({ ok: true });
}
