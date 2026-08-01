import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { textOf, usageOf } from "@/lib/anthropic";
import { MODEL } from "@/lib/config";
import { TREND_PROMPT, TREND_PROMPT_VERSION } from "@/lib/prompts";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { getUserAnthropic, markKeyVerified } from "@/lib/keys";
import { userFacingAnthropicError } from "@/lib/errors";

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

// One pass over the session user's whole corpus. Every claim must cite the
// dreams it rests on; claims without citations are dropped (the DB CHECK also
// enforces non-empty). Prior runs are never touched.
export async function POST(req: NextRequest) {
  const userId = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sql = getSql();
  const dreamRows = (await sql`
    SELECT id, sequence_no, dreamt_on, raw_transcript
    FROM dreams WHERE user_id = ${userId} ORDER BY sequence_no ASC
  `) as Array<{ id: string; sequence_no: number; dreamt_on: unknown; raw_transcript: string }>;

  const corpusSize = dreamRows.length;
  if (corpusSize === 0) {
    return NextResponse.json({ error: "no_dreams", message: "Record a dream first." }, { status: 400 });
  }

  const idBySeq = new Map<number, string>();
  const corpusText = dreamRows
    .map((d) => {
      const seq = Number(d.sequence_no);
      idBySeq.set(seq, String(d.id));
      const date =
        d.dreamt_on instanceof Date ? d.dreamt_on.toISOString().slice(0, 10) : String(d.dreamt_on ?? "");
      return `Dream ${seq} (${date}):\n${d.raw_transcript}`;
    })
    .join("\n\n---\n\n");

  const got = await getUserAnthropic(userId);
  if ("error" in got) {
    return NextResponse.json(
      { error: "no_key", message: "Add your Anthropic API key in Settings to run a trend pass." },
      { status: 400 }
    );
  }

  let summary = "";
  let claims: Array<{ claim: string; dreamIds: string[] }> = [];
  let usage: { input: number; output: number };
  try {
    const message = await got.client.messages.create({
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
      return NextResponse.json(
        { error: "refusal", message: "The model declined this request." },
        { status: 502 }
      );
    }
    usage = usageOf(message);
    const parsed = JSON.parse(textOf(message)) as {
      summary?: string;
      claims?: Array<{ claim?: string; dream_numbers?: number[] }>;
    };
    summary = typeof parsed.summary === "string" ? parsed.summary : "";
    claims = (parsed.claims ?? [])
      .map((c) => ({
        claim: (c.claim ?? "").trim(),
        dreamIds: Array.from(
          new Set(
            (c.dream_numbers ?? [])
              .map((n) => idBySeq.get(Number(n)))
              .filter((id): id is string => typeof id === "string")
          )
        ),
      }))
      .filter((c) => c.claim.length > 0 && c.dreamIds.length > 0);
  } catch (err) {
    const m = userFacingAnthropicError(err);
    return NextResponse.json({ error: "llm", message: m.message }, { status: m.status });
  }

  const [run] = (await sql`
    INSERT INTO trend_runs (user_id, corpus_size, model, prompt_version, body, input_tokens, output_tokens)
    VALUES (${userId}, ${corpusSize}, ${MODEL}, ${TREND_PROMPT_VERSION}, ${summary}, ${usage.input}, ${usage.output})
    RETURNING id
  `) as Array<{ id: string }>;

  for (const c of claims) {
    await sql`
      INSERT INTO trend_claims (trend_run_id, claim, dream_ids)
      VALUES (${run.id}, ${c.claim}, ${c.dreamIds}::uuid[])
    `;
  }
  // Permanent spend record — independent of any single dream (0009).
  await sql`
    INSERT INTO usage_events (user_id, kind, input_tokens, output_tokens)
    VALUES (${userId}, 'trend', ${usage.input}, ${usage.output})
  `;
  await markKeyVerified(got.keyId);

  return NextResponse.json({ id: run.id, corpusSize, claimsWritten: claims.length });
}
