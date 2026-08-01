import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { CAPTURE_METHOD, MODEL } from "@/lib/config";
import { RESTATEMENT_PROMPT_VERSION } from "@/lib/prompts";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { getUserAnthropic, markKeyVerified } from "@/lib/keys";
import { generateTitle } from "@/lib/titles";
import { prepareCounterpart } from "@/lib/translations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// This route calls the model, which runs well past the platform default (~10-15s).
export const maxDuration = 60;

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

  // Best-effort title generation. Never throws; if there's no key or the call
  // fails, the dream still saves and the list derives a title instead.
  const got = await getUserAnthropic(userId);
  const titleResult = "error" in got ? null : await generateTitle(got.client, rawTranscript);

  const [dream] = (await sql`
    INSERT INTO dreams (user_id, sequence_no, dreamt_on, capture_method, raw_transcript)
    VALUES (${userId}, ${sequenceNo}, ${dreamtOn}, ${CAPTURE_METHOD}, ${rawTranscript})
    RETURNING id
  `) as Array<{ id: string }>;

  // Title lives in its own table (editable; not part of the immutable dream).
  // Bookkeeping only — the dream is already saved, so nothing here may throw.
  if (titleResult && !("error" in got)) {
    try {
      await sql`
        INSERT INTO dream_titles (dream_id, title, source)
        VALUES (${dream.id}, ${titleResult.title}, 'generated')
        ON CONFLICT (dream_id) DO NOTHING
      `;
    } catch (err) {
      console.error("[rehm] title write failed:", err);
    }
    try {
      await sql`
        INSERT INTO usage_events (user_id, kind, input_tokens, output_tokens)
        VALUES (${userId}, 'title', ${titleResult.usage.input}, ${titleResult.usage.output})
      `;
    } catch (err) {
      console.error("[rehm] usage write failed:", err);
    }
    await markKeyVerified(got.keyId);
  }

  const [restatement] = (await sql`
    INSERT INTO restatements (dream_id, model, prompt_version, accepted)
    VALUES (${dream.id}, ${MODEL}, ${RESTATEMENT_PROMPT_VERSION}, false)
    RETURNING id
  `) as Array<{ id: string }>;

  // Prepare the other language now, while the text is new, so the toggle is
  // instant rather than a spinner when someone is handed the phone. No-op on a
  // single-language account. The dream is already saved; this cannot fail it.
  await prepareCounterpart(userId, [
    { type: "dream", id: dream.id, text: rawTranscript },
    ...(titleResult
      ? [{ type: "title" as const, id: dream.id, text: titleResult.title }]
      : []),
  ]);

  return NextResponse.json({
    dreamId: dream.id,
    restatementId: restatement.id,
    sequenceNo,
  });
}
