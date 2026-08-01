import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { CAPTURE_METHOD, MODEL } from "@/lib/config";
import { RESTATEMENT_PROMPT_VERSION } from "@/lib/prompts";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { getUserAnthropic, markKeyVerified } from "@/lib/keys";
import { generateTitle } from "@/lib/titles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Create a dream from the captured transcript (verbatim) and open a restatement
// row for the loop. A short title is generated best-effort (cheap model) so the
// list is scannable — but capture NEVER depends on it or on a working key: if
// there is no key or the title call fails, the raw transcript is still saved
// and the list falls back to a transcript-derived title.
export async function POST(req: NextRequest) {
  const userId = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as { rawTranscript?: string; dreamtOn?: string };
  const rawTranscript = (body.rawTranscript ?? "").trim();
  const dreamtOn = body.dreamtOn ?? "";

  if (!rawTranscript) {
    return NextResponse.json({ error: "empty transcript" }, { status: 400 });
  }
  if (!DATE_RE.test(dreamtOn) || Number.isNaN(Date.parse(`${dreamtOn}T00:00:00Z`))) {
    return NextResponse.json({ error: "invalid dreamt_on" }, { status: 400 });
  }

  const sql = getSql();
  const [{ next }] = (await sql`
    SELECT coalesce(max(sequence_no), 0) + 1 AS next
    FROM dreams WHERE user_id = ${userId}
  `) as Array<{ next: unknown }>;
  const sequenceNo = Number(next);

  // Best-effort title. Never throws; a null title just means the list derives
  // one from the transcript. Title must be set at INSERT because dreams is
  // immutable (0007), so this runs before the insert.
  let title: string | null = null;
  const got = await getUserAnthropic(userId);
  if (!("error" in got)) {
    const result = await generateTitle(got.client, rawTranscript);
    if (result) {
      title = result.title;
      await sql`
        INSERT INTO usage_events (user_id, kind, input_tokens, output_tokens)
        VALUES (${userId}, 'title', ${result.usage.input}, ${result.usage.output})
      `;
      await markKeyVerified(got.keyId);
    }
  }

  const [dream] = (await sql`
    INSERT INTO dreams (user_id, sequence_no, dreamt_on, capture_method, raw_transcript, title)
    VALUES (${userId}, ${sequenceNo}, ${dreamtOn}, ${CAPTURE_METHOD}, ${rawTranscript}, ${title})
    RETURNING id
  `) as Array<{ id: string }>;

  const [restatement] = (await sql`
    INSERT INTO restatements (dream_id, model, prompt_version, accepted)
    VALUES (${dream.id}, ${MODEL}, ${RESTATEMENT_PROMPT_VERSION}, false)
    RETURNING id
  `) as Array<{ id: string }>;

  return NextResponse.json({
    dreamId: dream.id,
    restatementId: restatement.id,
    sequenceNo,
  });
}
