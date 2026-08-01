import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { parseScope, scopeLabel, selectInScope } from "@/lib/scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Dreams read per batch. Small enough that one batch always finishes inside the
// function time limit, with headroom for long transcripts. (Not exported — a
// route file may only export route handlers and segment config.)
const BATCH_SIZE = 3;

// Create a queued trend pass. This does no model work — it resolves the scope,
// splits it into batches, and returns immediately. The caller then drives the
// job one step at a time.
export async function POST(req: NextRequest) {
  const userId = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { scope?: unknown; source?: unknown };
  const source: "dreams" | "dreams_and_analyses" =
    body.source === "dreams_and_analyses" ? "dreams_and_analyses" : "dreams";
  const parsed = parseScope(body.scope);
  if ("error" in parsed) {
    return NextResponse.json({ error: "scope", message: parsed.error }, { status: 400 });
  }
  const scope = parsed.scope;

  const sql = getSql();
  const allRows = (await sql`
    SELECT id, sequence_no, dreamt_on FROM dreams
    WHERE user_id = ${userId} ORDER BY sequence_no ASC
  `) as Array<{ id: string; sequence_no: number; dreamt_on: unknown }>;

  if (allRows.length === 0) {
    return NextResponse.json({ error: "no_dreams", message: "Record a dream first." }, { status: 400 });
  }

  const scoped = selectInScope(
    allRows.map((d) => ({
      sequenceNo: Number(d.sequence_no),
      dreamtOn:
        d.dreamt_on instanceof Date
          ? d.dreamt_on.toISOString().slice(0, 10)
          : d.dreamt_on == null
            ? null
            : String(d.dreamt_on).slice(0, 10),
      id: String(d.id),
    })),
    scope
  ).sort((a, b) => a.sequenceNo - b.sequenceNo);

  if (scoped.length === 0) {
    return NextResponse.json(
      { error: "empty_scope", message: "No dreams fall in that range." },
      { status: 400 }
    );
  }

  const batches: Array<typeof scoped> = [];
  for (let i = 0; i < scoped.length; i += BATCH_SIZE) {
    batches.push(scoped.slice(i, i + BATCH_SIZE));
  }

  const label = scopeLabel(scope);
  const [job] = (await sql`
    INSERT INTO trend_jobs (
      user_id, source, scope_kind, scope_label, scope_last_n, scope_from, scope_to,
      dream_numbers, total_batches
    )
    VALUES (
      ${userId}, ${source}, ${scope.kind}, ${label},
      ${scope.kind === "last_n" ? scope.lastN : null},
      ${scope.kind === "range" ? scope.from : null},
      ${scope.kind === "range" ? scope.to : null},
      ${scoped.map((d) => d.sequenceNo)}::int[],
      ${batches.length}
    )
    RETURNING id
  `) as Array<{ id: string }>;

  for (const [i, batch] of batches.entries()) {
    await sql`
      INSERT INTO trend_job_batches (job_id, batch_no, dream_ids, dream_numbers)
      VALUES (
        ${job.id}, ${i + 1},
        ${batch.map((d) => d.id)}::uuid[],
        ${batch.map((d) => d.sequenceNo)}::int[]
      )
    `;
  }

  return NextResponse.json({
    jobId: String(job.id),
    totalBatches: batches.length,
    dreams: scoped.length,
    scopeLabel: label,
  });
}
