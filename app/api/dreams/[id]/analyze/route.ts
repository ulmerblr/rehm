import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { getAnthropic, textOf } from "@/lib/anthropic";
import { SUBJECT_ID, MODEL } from "@/lib/config";
import { ANALYSIS_PROMPT, ANALYSIS_PROMPT_VERSION } from "@/lib/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Blind analysis generated from the raw transcript ONLY — not the restatement,
// not prior dreams, not prior analyses, not any theme vocabulary. Re-runnable:
// a new row every time, never overwriting. Stored with blind = true.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: dreamId } = await params;
  const sql = getSql();

  const rows = (await sql`
    SELECT raw_transcript FROM dreams
    WHERE id = ${dreamId} AND user_id = ${SUBJECT_ID}
  `) as Array<{ raw_transcript: string }>;
  if (rows.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const raw = rows[0].raw_transcript;

  const client = getAnthropic();
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: ANALYSIS_PROMPT,
    messages: [{ role: "user", content: raw }],
  });
  if (message.stop_reason === "refusal") {
    return NextResponse.json({ error: "model declined the request" }, { status: 502 });
  }
  const analysis = textOf(message);
  if (!analysis) {
    return NextResponse.json({ error: "empty analysis" }, { status: 502 });
  }

  const [row] = (await sql`
    INSERT INTO analyses (dream_id, body, model, prompt_version, blind)
    VALUES (${dreamId}, ${analysis}, ${MODEL}, ${ANALYSIS_PROMPT_VERSION}, true)
    RETURNING id
  `) as Array<{ id: string }>;

  return NextResponse.json({ id: row.id, body: analysis });
}
