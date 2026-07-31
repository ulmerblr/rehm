import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { SUBJECT_ID, CAPTURE_METHOD, MODEL } from "@/lib/config";
import { RESTATEMENT_PROMPT_VERSION } from "@/lib/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Create a dream from the captured transcript (written verbatim, never touched
// again) and open a restatement row for the loop.
export async function POST(req: NextRequest) {
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
    FROM dreams WHERE user_id = ${SUBJECT_ID}
  `) as Array<{ next: unknown }>;
  const sequenceNo = Number(next);

  const [dream] = (await sql`
    INSERT INTO dreams (user_id, sequence_no, dreamt_on, capture_method, raw_transcript)
    VALUES (${SUBJECT_ID}, ${sequenceNo}, ${dreamtOn}, ${CAPTURE_METHOD}, ${rawTranscript})
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
