import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { textOf, usageOf } from "@/lib/anthropic";
import { MODEL } from "@/lib/config";
import {
  TREND_BATCH_PROMPT,
  TREND_SYNTHESIS_PROMPT,
  TREND_PROMPT_VERSION,
} from "@/lib/prompts";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { getUserAnthropic, markKeyVerified } from "@/lib/keys";
import { userFacingAnthropicError } from "@/lib/errors";
import { addendaByDream, latestAnalysisByDream } from "@/lib/queries";
import { composeDreamText } from "@/lib/dreamText";
import { prepareCounterpart } from "@/lib/translations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SYNTHESIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    closing: { type: "string" },
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
  required: ["summary", "claims", "closing"],
} as const;

// Advance a queued trend pass by exactly one step: read the next pending batch,
// or — when every batch is read — synthesize them into the finished run. One
// model call per request, so no step can outlive the function's time limit
// however large the corpus grows.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: jobId } = await params;
  if (!UUID_RE.test(jobId)) return NextResponse.json({ error: "not found" }, { status: 404 });

  const sql = getSql();
  const [job] = (await sql`
    SELECT * FROM trend_jobs WHERE id = ${jobId} AND user_id = ${userId}
  `) as Array<Record<string, unknown>>;
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (job.status === "done") {
    return NextResponse.json({ status: "done", trendRunId: job.trend_run_id ?? null, done: true });
  }
  if (job.status === "canceled") {
    return NextResponse.json({ status: "canceled", done: true });
  }

  const got = await getUserAnthropic(userId);
  if ("error" in got) {
    return NextResponse.json(
      { error: "no_key", message: "Add your Anthropic API key in Settings to run a trend pass." },
      { status: 400 }
    );
  }

  // Claim the next batch atomically — the status flip to 'running' is what
  // makes the claim, so two concurrent steps can't take the same batch. A batch
  // left 'running' by an interrupted step (a killed function, a closed tab) is
  // reclaimed after a couple of minutes rather than stranding the job.
  const claimed = (await sql`
    UPDATE trend_job_batches SET status = 'running', updated_at = now()
    WHERE id = (
      SELECT id FROM trend_job_batches
      WHERE job_id = ${jobId}
        AND (status = 'pending'
             OR (status = 'running' AND updated_at < now() - interval '2 minutes'))
      ORDER BY batch_no ASC LIMIT 1
    )
    RETURNING id, batch_no, dream_ids, dream_numbers
  `) as Array<Record<string, unknown>>;

  const progress = async () => {
    const [c] = (await sql`
      SELECT count(*) FILTER (WHERE status = 'done') AS done, count(*) AS total
      FROM trend_job_batches WHERE job_id = ${jobId}
    `) as Array<{ done: unknown; total: unknown }>;
    return { completed: Number(c.done), total: Number(c.total) };
  };

  // ---- Stage 1: read one batch -------------------------------------------
  if (claimed.length > 0) {
    const batch = claimed[0];
    const dreamIds = (batch.dream_ids as unknown[]).map(String);

    const rows = (await sql`
      SELECT id, sequence_no, dreamt_on, raw_transcript
      FROM dreams WHERE id = ANY(${dreamIds}::uuid[]) AND user_id = ${userId}
      ORDER BY sequence_no ASC
    `) as Array<{ id: string; sequence_no: number; dreamt_on: unknown; raw_transcript: string }>;

    const addenda = await addendaByDream(userId);
    const analyses =
      job.source === "dreams_and_analyses"
        ? await latestAnalysisByDream(userId)
        : new Map<string, string>();

    const corpusText = rows
      .map((r) => {
        const date =
          r.dreamt_on instanceof Date
            ? r.dreamt_on.toISOString().slice(0, 10)
            : String(r.dreamt_on ?? "no date");
        const text = composeDreamText(r.raw_transcript, addenda.get(String(r.id)) ?? []);
        const analysis = analyses.get(String(r.id));
        const block = `Dream ${Number(r.sequence_no)} (${date}):\n${text}`;
        return analysis
          ? `${block}\n\n[Earlier interpretation of Dream ${Number(r.sequence_no)} — not the dreamer's words]\n${analysis}`
          : block;
      })
      .join("\n\n---\n\n");

    try {
      const stream = got.client.messages.stream({
        model: MODEL,
        max_tokens: 8000,
        system: TREND_BATCH_PROMPT,
        messages: [{ role: "user", content: corpusText }],
        output_config: { effort: "low" },
      });
      const message = await stream.finalMessage();
      if (message.stop_reason === "refusal") throw new Error("The model declined this batch.");

      const observations = textOf(message);
      const usage = usageOf(message);

      await sql`
        UPDATE trend_job_batches
        SET status = 'done', observations = ${observations}, error = NULL, updated_at = now()
        WHERE id = ${String(batch.id)}
      `;
      await sql`
        UPDATE trend_jobs
        SET input_tokens = input_tokens + ${usage.input},
            output_tokens = output_tokens + ${usage.output},
            updated_at = now()
        WHERE id = ${jobId}
      `;
      await markKeyVerified(got.keyId);
    } catch (err) {
      const m = userFacingAnthropicError(err);
      // Back to pending, so retrying the job re-reads this batch rather than
      // skipping it and synthesizing from an incomplete corpus.
      await sql`
        UPDATE trend_job_batches
        SET status = 'pending', error = ${m.detail}, updated_at = now()
        WHERE id = ${String(batch.id)}
      `;
      return NextResponse.json(
        { error: "llm", message: m.message, detail: m.detail, stage: "batch" },
        { status: m.status }
      );
    }

    const p = await progress();
    return NextResponse.json({ status: "running", stage: "batch", done: false, ...p });
  }

  // ---- Stage 2: synthesize -------------------------------------------------
  // Nothing was claimable, but that isn't the same as "everything is read": a
  // batch may be in flight in another request. Synthesizing now would draw
  // conclusions from an incomplete corpus, which is the one thing this design
  // must never do.
  const pre = await progress();
  if (pre.completed < pre.total) {
    return NextResponse.json({ status: "running", stage: "waiting", done: false, ...pre });
  }

  const batchRows = (await sql`
    SELECT batch_no, dream_numbers, observations FROM trend_job_batches
    WHERE job_id = ${jobId} AND status = 'done' ORDER BY batch_no ASC
  `) as Array<Record<string, unknown>>;

  if (batchRows.length === 0) {
    return NextResponse.json({ error: "no_batches", message: "Nothing was read." }, { status: 500 });
  }

  const notes = batchRows
    .map(
      (b) =>
        `Observations from dreams ${(b.dream_numbers as unknown[]).join(", ")}:\n${String(b.observations ?? "")}`
    )
    .join("\n\n---\n\n");

  const corpusSize = (job.dream_numbers as unknown[]).length;
  const label = String(job.scope_label);

  let summary = "";
  let closing = "";
  let claims: Array<{ claim: string; dreamNumbers: number[] }> = [];
  let usage = { input: 0, output: 0 };
  try {
    const stream = got.client.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      system: TREND_SYNTHESIS_PROMPT,
      messages: [
        {
          role: "user",
          content: `These observations come from ${corpusSize} dream(s) — the slice selected as "${label}". Dream numbers are positions in the full corpus, so they may not start at 1.\n\n${notes}`,
        },
      ],
      output_config: { effort: "medium", format: { type: "json_schema", schema: SYNTHESIS_SCHEMA } },
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") throw new Error("The model declined the synthesis.");
    if (message.stop_reason === "max_tokens") throw new Error("The synthesis was cut off.");

    usage = usageOf(message);
    const parsed = JSON.parse(textOf(message)) as {
      summary?: string;
      closing?: string;
      claims?: Array<{ claim?: string; dream_numbers?: number[] }>;
    };
    summary = typeof parsed.summary === "string" ? parsed.summary : "";
    closing = typeof parsed.closing === "string" ? parsed.closing : "";
    claims = (parsed.claims ?? [])
      .map((c) => ({
        claim: (c.claim ?? "").trim(),
        dreamNumbers: Array.from(new Set((c.dream_numbers ?? []).map(Number))),
      }))
      .filter((c) => c.claim.length > 0 && c.dreamNumbers.length > 0);
  } catch (err) {
    const m = userFacingAnthropicError(err);
    return NextResponse.json(
      { error: "llm", message: m.message, detail: m.detail, stage: "synthesis" },
      { status: m.status }
    );
  }

  // Resolve cited dream numbers back to ids, dropping any the model invented.
  const inScope = new Set((job.dream_numbers as unknown[]).map(Number));
  const idRows = (await sql`
    SELECT id, sequence_no FROM dreams WHERE user_id = ${userId}
  `) as Array<{ id: string; sequence_no: number }>;
  const idBySeq = new Map<number, string>();
  for (const r of idRows) idBySeq.set(Number(r.sequence_no), String(r.id));

  const resolved = claims
    .map((c) => ({
      claim: c.claim,
      dreamIds: c.dreamNumbers
        .filter((n) => inScope.has(n))
        .map((n) => idBySeq.get(n))
        .filter((id): id is string => typeof id === "string"),
    }))
    .filter((c) => c.dreamIds.length > 0);

  const totalIn = Number(job.input_tokens) + usage.input;
  const totalOut = Number(job.output_tokens) + usage.output;

  const [run] = (await sql`
    INSERT INTO trend_runs (
      user_id, corpus_size, model, prompt_version, body, closing, dream_numbers,
      source, input_tokens, output_tokens,
      scope_kind, scope_label, scope_last_n, scope_from, scope_to
    )
    VALUES (
      ${userId}, ${corpusSize}, ${MODEL}, ${TREND_PROMPT_VERSION}, ${summary},
      ${closing}, ${(job.dream_numbers as unknown[]).map(Number)}::int[],
      ${String(job.source)}, ${totalIn}, ${totalOut},
      ${String(job.scope_kind)}, ${label},
      ${job.scope_last_n ?? null}, ${job.scope_from ?? null}, ${job.scope_to ?? null}
    )
    RETURNING id
  `) as Array<{ id: string }>;

  const claimIds: Array<{ id: string; claim: string }> = [];
  for (const c of resolved) {
    const [ins] = (await sql`
      INSERT INTO trend_claims (trend_run_id, claim, dream_ids)
      VALUES (${run.id}, ${c.claim}, ${c.dreamIds}::uuid[])
      RETURNING id
    `) as Array<{ id: string }>;
    claimIds.push({ id: String(ins.id), claim: c.claim });
  }

  try {
    await sql`
      INSERT INTO usage_events (user_id, kind, input_tokens, output_tokens)
      VALUES (${userId}, 'trend', ${totalIn}, ${totalOut})
    `;
  } catch (err) {
    console.error("[rehm] usage write failed:", err);
  }

  await sql`
    UPDATE trend_jobs
    SET status = 'done', trend_run_id = ${run.id},
        input_tokens = ${totalIn}, output_tokens = ${totalOut}, updated_at = now()
    WHERE id = ${jobId}
  `;
  await markKeyVerified(got.keyId);

  // A trend pass is the thing you'd most want to hand the phone over for, so
  // its closing and claims get the other language prepared now. This runs on
  // the last step of an already-queued job, so it has the whole budget to
  // itself; the run is written and safe before any of it starts.
  await prepareCounterpart(userId, [
    ...(closing ? [{ type: "trend_closing" as const, id: String(run.id), text: closing }] : []),
    ...claimIds.map((c) => ({ type: "trend_claim" as const, id: c.id, text: c.claim })),
  ]);

  const p = await progress();
  return NextResponse.json({
    status: "done",
    stage: "synthesis",
    done: true,
    trendRunId: String(run.id),
    claimsWritten: resolved.length,
    ...p,
  });
}
