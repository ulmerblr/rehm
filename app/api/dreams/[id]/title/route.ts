import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prepareCounterpart } from "@/lib/translations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Renaming may re-translate the title, which calls the model.
export const maxDuration = 60;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Set or overwrite a dream's title with the user's own text. Titles are
// editable metadata (dream_titles), separate from the immutable transcript, so
// this works for any dream — including ones whose title was only ever derived.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: dreamId } = await params;
  if (!UUID_RE.test(dreamId)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { title?: string };
  const title = String(body.title ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!title) {
    return NextResponse.json({ error: "empty", message: "Title can't be empty." }, { status: 400 });
  }

  const sql = getSql();
  const owned = (await sql`
    SELECT 1 FROM dreams WHERE id = ${dreamId} AND user_id = ${userId}
  `) as Array<unknown>;
  if (owned.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await sql`
    INSERT INTO dream_titles (dream_id, title, source, updated_at)
    VALUES (${dreamId}, ${title}, 'edited', now())
    ON CONFLICT (dream_id)
    DO UPDATE SET title = EXCLUDED.title, source = 'edited', updated_at = now()
  `;

  // A rename makes any stored translation of the old title wrong. Translations
  // are immutable, so the correction is retire-then-write, not an edit. Losing
  // the row is safe: an absent translation falls back to showing the original.
  try {
    await sql`
      DELETE FROM translations WHERE source_type = 'title' AND source_id = ${dreamId}
    `;
  } catch (err) {
    console.error("[rehm] stale title translation not cleared:", err);
  }
  await prepareCounterpart(userId, [{ type: "title", id: dreamId, text: title }]);

  return NextResponse.json({ ok: true, title });
}
