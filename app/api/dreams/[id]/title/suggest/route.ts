import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { getUserAnthropic, markKeyVerified } from "@/lib/keys";
import { generateTitle } from "@/lib/titles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Generate a title for an existing dream, on demand. Dreams captured before
// titles existed (or without a key on file) have nothing to type over, so this
// produces a suggestion they can accept or edit. Saved as 'generated', so a
// later hand-edit still wins.
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

  const sql = getSql();
  const rows = (await sql`
    SELECT raw_transcript FROM dreams WHERE id = ${dreamId} AND user_id = ${userId}
  `) as Array<{ raw_transcript: string }>;
  if (rows.length === 0) return NextResponse.json({ error: "not found" }, { status: 404 });

  const got = await getUserAnthropic(userId);
  if ("error" in got) {
    return NextResponse.json(
      { error: "no_key", message: "Add your Anthropic API key in Settings to suggest a title." },
      { status: 400 }
    );
  }

  const result = await generateTitle(got.client, rows[0].raw_transcript);
  if (!result) {
    return NextResponse.json(
      { error: "failed", message: "Couldn't generate a title. Type one instead." },
      { status: 502 }
    );
  }

  await sql`
    INSERT INTO dream_titles (dream_id, title, source, updated_at)
    VALUES (${dreamId}, ${result.title}, 'generated', now())
    ON CONFLICT (dream_id)
    DO UPDATE SET title = EXCLUDED.title, source = 'generated', updated_at = now()
  `;
  try {
    await sql`
      INSERT INTO usage_events (user_id, kind, input_tokens, output_tokens, billed_to)
      VALUES (${userId}, 'title', ${result.usage.input}, ${result.usage.output}, ${got.billedTo})
    `;
  } catch (err) {
    console.error("[rehm] usage write failed:", err);
  }
  await markKeyVerified(got.keyId);

  return NextResponse.json({ ok: true, title: result.title });
}
