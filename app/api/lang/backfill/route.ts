import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { getLangSettings } from "@/lib/translations";
import { pendingItems } from "@/lib/backfill";
import { otherLang } from "@/lib/lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Open a backfill: translate everything already recorded into the other
// language. Twenty-odd model calls is far past a single request's budget, so
// this only creates the job — the client then drives it a chunk at a time,
// exactly like a trend pass.
export async function POST(req: NextRequest) {
  const userId = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { language } = await getLangSettings(userId);
  const target = otherLang(language);
  const sql = getSql();

  // Resume rather than duplicate: a job left open by a closed tab is the one
  // to continue, not a reason to start a second one billing for the same work.
  const open = (await sql`
    SELECT id FROM translation_jobs
    WHERE user_id = ${userId} AND target_lang = ${target} AND status = 'pending'
    ORDER BY created_at DESC LIMIT 1
  `) as Array<{ id: string }>;
  if (open.length > 0) {
    return NextResponse.json({ jobId: String(open[0].id), resumed: true });
  }

  const items = await pendingItems(userId, target);
  if (items.length === 0) {
    return NextResponse.json({ jobId: null, items: 0, done: true });
  }

  const [job] = (await sql`
    INSERT INTO translation_jobs (user_id, target_lang, total_items)
    VALUES (${userId}, ${target}, ${items.length})
    RETURNING id
  `) as Array<{ id: string }>;

  return NextResponse.json({ jobId: String(job.id), items: items.length });
}
