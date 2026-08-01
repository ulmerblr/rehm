import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Progress for a queued trend pass — how many batches are read, and whether the
// run has been written. Safe to poll.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: jobId } = await params;
  if (!UUID_RE.test(jobId)) return NextResponse.json({ error: "not found" }, { status: 404 });

  const sql = getSql();
  const [job] = (await sql`
    SELECT id, status, scope_label, total_batches, trend_run_id, error
    FROM trend_jobs WHERE id = ${jobId} AND user_id = ${userId}
  `) as Array<Record<string, unknown>>;
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [c] = (await sql`
    SELECT count(*) FILTER (WHERE status = 'done') AS done, count(*) AS total
    FROM trend_job_batches WHERE job_id = ${jobId}
  `) as Array<{ done: unknown; total: unknown }>;

  return NextResponse.json({
    jobId: String(job.id),
    status: String(job.status),
    scopeLabel: String(job.scope_label),
    completed: Number(c.done),
    total: Number(c.total),
    trendRunId: job.trend_run_id == null ? null : String(job.trend_run_id),
    error: job.error == null ? null : String(job.error),
  });
}

// Abandon a queued pass. Batches already read are kept — resuming later would
// re-use them — but the job stops being offered for resumption.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: jobId } = await params;
  if (!UUID_RE.test(jobId)) return NextResponse.json({ error: "not found" }, { status: 404 });

  const sql = getSql();
  await sql`
    UPDATE trend_jobs SET status = 'canceled', updated_at = now()
    WHERE id = ${jobId} AND user_id = ${userId} AND status = 'pending'
  `;
  return NextResponse.json({ ok: true });
}
