import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prepareCounterpart } from "@/lib/translations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Adding to a dream may translate the addition, which calls the model.
export const maxDuration = 60;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Append something remembered after capture. This never touches the original
// transcript — it adds a separate, timestamped record, because when a detail
// resurfaced is part of what the detail means.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: dreamId } = await params;
  if (!UUID_RE.test(dreamId)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const parsed = (await req.json().catch(() => ({}))) as { body?: string };
  const body = String(parsed.body ?? "").trim();
  if (!body) {
    return NextResponse.json(
      { error: "empty", message: "Nothing to add." },
      { status: 400 }
    );
  }

  const sql = getSql();
  const owned = (await sql`
    SELECT 1 FROM dreams WHERE id = ${dreamId} AND user_id = ${userId}
  `) as Array<unknown>;
  if (owned.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Ordinal is derived server-side; two quick additions can't collide on it
  // because (dream_id, addendum_no) is unique — a loser retries by re-posting.
  const [{ next }] = (await sql`
    SELECT coalesce(max(addendum_no), 0) + 1 AS next
    FROM dream_addenda WHERE dream_id = ${dreamId}
  `) as Array<{ next: unknown }>;

  const [row] = (await sql`
    INSERT INTO dream_addenda (dream_id, addendum_no, body)
    VALUES (${dreamId}, ${Number(next)}, ${body})
    RETURNING id, addendum_no, captured_at
  `) as Array<Record<string, unknown>>;

  await prepareCounterpart(userId, [
    { type: "addendum", id: String(row.id), text: body },
  ]);

  return NextResponse.json({
    ok: true,
    id: String(row.id),
    addendumNo: Number(row.addendum_no),
  });
}
