import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { getAnthropic, textOf } from "@/lib/anthropic";
import { SUBJECT_ID, MODEL } from "@/lib/config";
import { TREND_PROMPT, TREND_PROMPT_VERSION } from "@/lib/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    claims: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          claim: { type: "string" },
          dream_numbers: { type: "array", items: { type: "integer" } },
        },
        required: ["claim", "dream_numbers"],
      },
    },
  },
  required: ["summary", "claims"],
} as const;

// Reads every raw transcript, runs one pass over the whole corpus, and writes a
// trend_run plus trend_claims. Every claim must cite the dreams it rests on; a
// claim that cites nothing is dropped (the DB CHECK also enforces non-empty).
// Prior trend runs are never touched.
export async function POST(_req: NextRequest) {
  const sql = getSql();

  const dreamRows = (await sql`
    SELECT id, sequence_no, dreamt_on, raw_transcript
    FROM dreams WHERE user_id = ${SUBJECT_ID}
    ORDER BY sequence_no ASC
  `) as Array<{
    id: string;
    sequence_no: number;
    dreamt_on: unknown;
    raw_transcript: string;
  }>;

  const corpusSize = dreamRows.length;
  if (corpusSize === 0) {
    return NextResponse.json({ error: "no dreams to analyze" }, { status: 400 });
  }

  // seq -> uuid, for mapping cited dream numbers back to real ids.
  const idBySeq = new Map<number, string>();
  const corpusText = dreamRows
    .map((d) => {
      const seq = Number(d.sequence_no);
      idBySeq.set(seq, String(d.id));
      const date =
        d.dreamt_on instanceof Date
          ? d.dreamt_on.toISOString().slice(0, 10)
          : String(d.dreamt_on ?? "");
      return `Dream ${seq} (${date}):\n${d.raw_transcript}`;
    })
    .join("\n\n---\n\n");

  const client = getAnthropic();
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: TREND_PROMPT,
    messages: [
      {
        role: "user",
        content: `Here is the full corpus of ${corpusSize} dream(s). Identify trends across them, citing dream numbers for every claim.\n\n${corpusText}`,
      },
    ],
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
  });
  if (message.stop_reason === "refusal") {
    return NextResponse.json({ error: "model declined the request" }, { status: 502 });
  }

  let parsed: { summary?: string; claims?: Array<{ claim?: string; dream_numbers?: number[] }> };
  try {
    parsed = JSON.parse(textOf(message));
  } catch {
    return NextResponse.json({ error: "could not parse trend output" }, { status: 502 });
  }

  const summary = typeof parsed.summary === "string" ? parsed.summary : "";

  // Keep only claims that cite at least one real dream in this corpus.
  const claims = (parsed.claims ?? [])
    .map((c) => {
      const ids = Array.from(
        new Set(
          (c.dream_numbers ?? [])
            .map((n) => idBySeq.get(Number(n)))
            .filter((id): id is string => typeof id === "string")
        )
      );
      return { claim: (c.claim ?? "").trim(), dreamIds: ids };
    })
    .filter((c) => c.claim.length > 0 && c.dreamIds.length > 0);

  const [run] = (await sql`
    INSERT INTO trend_runs (user_id, corpus_size, model, prompt_version, body)
    VALUES (${SUBJECT_ID}, ${corpusSize}, ${MODEL}, ${TREND_PROMPT_VERSION}, ${summary})
    RETURNING id
  `) as Array<{ id: string }>;

  for (const c of claims) {
    await sql`
      INSERT INTO trend_claims (trend_run_id, claim, dream_ids)
      VALUES (${run.id}, ${c.claim}, ${c.dreamIds}::uuid[])
    `;
  }

  return NextResponse.json({
    id: run.id,
    corpusSize,
    claimsWritten: claims.length,
  });
}
