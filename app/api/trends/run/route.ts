import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { textOf, usageOf } from "@/lib/anthropic";
import { MODEL } from "@/lib/config";
import { TREND_PROMPT, TREND_PROMPT_VERSION } from "@/lib/prompts";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { getUserAnthropic, markKeyVerified } from "@/lib/keys";
import { userFacingAnthropicError } from "@/lib/errors";
import { parseScope, scopeLabel, selectInScope } from "@/lib/scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A trend pass reads the corpus and the model thinks before answering, so this
// runs far longer than the platform's default function timeout (~10-15s). 60s
// is the ceiling on every Vercel plan.
export const maxDuration = 60;

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

// One pass over a chosen slice of the session user's corpus — everything, the
// last N dreams, or a date range. Every claim must cite the dreams it rests on;
// claims without citations are dropped (the DB CHECK also enforces non-empty).
// Prior runs are never touched, and the scope is recorded on the run so an old
// run stays interpretable.
export async function POST(req: NextRequest) {
  const userId = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { scope?: unknown };
  const parsed = parseScope(body.scope);
  if ("error" in parsed) {
    return NextResponse.json({ error: "scope", message: parsed.error }, { status: 400 });
  }
  const scope = parsed.scope;

  const sql = getSql();
  const allRows = (await sql`
    SELECT id, sequence_no, dreamt_on, raw_transcript
    FROM dreams WHERE user_id = ${userId} ORDER BY sequence_no ASC
  `) as Array<{ id: string; sequence_no: number; dreamt_on: unknown; raw_transcript: string }>;

  if (allRows.length === 0) {
    return NextResponse.json({ error: "no_dreams", message: "Record a dream first." }, { status: 400 });
  }

  // Apply the scope with the same logic the client previews with, then restore
  // ascending order so the model reads the corpus chronologically.
  const scoped = selectInScope(
    allRows.map((d) => ({
      sequenceNo: Number(d.sequence_no),
      dreamtOn:
        d.dreamt_on instanceof Date
          ? d.dreamt_on.toISOString().slice(0, 10)
          : d.dreamt_on == null
            ? null
            : String(d.dreamt_on).slice(0, 10),
      row: d,
    })),
    scope
  ).sort((a, b) => a.sequenceNo - b.sequenceNo);

  const corpusSize = scoped.length;
  if (corpusSize === 0) {
    return NextResponse.json(
      { error: "empty_scope", message: "No dreams fall in that range." },
      { status: 400 }
    );
  }

  const label = scopeLabel(scope);
  const idBySeq = new Map<number, string>();
  const corpusText = scoped
    .map(({ sequenceNo, dreamtOn, row }) => {
      idBySeq.set(sequenceNo, String(row.id));
      return `Dream ${sequenceNo} (${dreamtOn ?? "no date"}):\n${row.raw_transcript}`;
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
    // max_tokens caps thinking AND the response together, and this model thinks
    // by default. A trend pass over a growing corpus needs real headroom — if it
    // runs out mid-JSON the parse below fails with a useless error, so give it
    // room and check for truncation explicitly.
    // Streamed, not a single request/response: a long generation would
    // otherwise risk an HTTP read timeout before the answer is complete. We
    // don't need the individual events, just the assembled message.
    const stream = got.client.messages.stream({
      model: MODEL,
      max_tokens: 32000,
      system: TREND_PROMPT,
      messages: [
        {
          role: "user",
          content: `Here are ${corpusSize} dream(s) — the slice of the corpus selected as "${label}". Identify trends across them, citing dream numbers for every claim. Dreams are numbered by their position in the full corpus, so the numbers may not start at 1.\n\n${corpusText}`,
        },
      ],
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "refusal", message: "The model declined this request." },
        { status: 502 }
      );
    }
    if (message.stop_reason === "max_tokens") {
      return NextResponse.json(
        {
          error: "truncated",
          message:
            "The trend pass ran out of room before it finished. Your corpus may have grown too large for a single run.",
        },
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
    return NextResponse.json(
      { error: "llm", message: m.message, detail: m.detail },
      { status: m.status }
    );
  }

  const [run] = (await sql`
    INSERT INTO trend_runs (
      user_id, corpus_size, model, prompt_version, body, input_tokens, output_tokens,
      scope_kind, scope_label, scope_last_n, scope_from, scope_to
    )
    VALUES (
      ${userId}, ${corpusSize}, ${MODEL}, ${TREND_PROMPT_VERSION}, ${summary},
      ${usage.input}, ${usage.output},
      ${scope.kind}, ${label},
      ${scope.kind === "last_n" ? scope.lastN : null},
      ${scope.kind === "range" ? scope.from : null},
      ${scope.kind === "range" ? scope.to : null}
    )
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
