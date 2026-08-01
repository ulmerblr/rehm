import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { translateAndStore } from "@/lib/translations";
import { batchByBudget, pendingItems } from "@/lib/backfill";
import { asLang } from "@/lib/lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Characters of source text per request, not items. Haiku runs at roughly a
// thousand characters a second, so ~12k leaves a wide margin under the 60s
// ceiling while letting a step carry many short titles or a couple of long
// transcripts — whichever it happens to find.
const CHAR_BUDGET = 12000;

// Do one chunk of a backfill and report progress.
//
// The work list is recomputed from the database every step rather than being
// stored on the job: pendingItems only returns what has no translation yet, so
// finished work simply stops appearing. That is what makes this both resumable
// (a killed tab loses nothing) and idempotent (nothing is ever paid for twice).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: jobId } = await params;
  if (!UUID_RE.test(jobId)) return NextResponse.json({ error: "not found" }, { status: 404 });

  const sql = getSql();
  const jobs = (await sql`
    SELECT id, target_lang, status, total_items, done_items, failed_items,
           input_tokens, output_tokens
    FROM translation_jobs WHERE id = ${jobId} AND user_id = ${userId}
  `) as Array<Record<string, unknown>>;
  if (jobs.length === 0) return NextResponse.json({ error: "not found" }, { status: 404 });

  const job = jobs[0];
  if (job.status !== "pending") {
    return NextResponse.json({
      done: true,
      status: String(job.status),
      completed: Number(job.done_items),
      total: Number(job.total_items),
      failed: Number(job.failed_items),
    });
  }

  const target = asLang(job.target_lang);
  const remaining = await pendingItems(userId, target);

  if (remaining.length === 0) {
    await sql`
      UPDATE translation_jobs SET status = 'done', updated_at = now() WHERE id = ${jobId}
    `;
    return NextResponse.json({
      done: true,
      status: "done",
      completed: Number(job.total_items),
      total: Number(job.total_items),
      failed: Number(job.failed_items),
    });
  }

  const chunk = batchByBudget(remaining, CHAR_BUDGET);
  const result = await translateAndStore(userId, chunk, target);

  const doneItems = Number(job.done_items) + result.done;
  // A failure is per-run, not cumulative: an item that failed last time is
  // still in `remaining`, so counting it again would double-count. This tracks
  // only what failed in this pass, and the run reports stragglers at the end.
  const failedItems = result.failed;
  const totalIn = Number(job.input_tokens) + result.usage.input;
  const totalOut = Number(job.output_tokens) + result.usage.output;

  // A chunk that translated nothing would be handed back unchanged on the next
  // step — the work list is derived from what's missing, so a permanently
  // failing item sits at the head of it forever. Without this the client would
  // spin on the same four items until its step budget ran out.
  if (result.done === 0 && result.failed > 0) {
    // Never got anywhere at all: no key on file, or every call is refusing.
    if (doneItems === 0) {
      await sql`
        UPDATE translation_jobs
        SET status = 'failed', failed_items = ${remaining.length},
            error = 'translation calls are not succeeding', updated_at = now()
        WHERE id = ${jobId}
      `;
      return NextResponse.json(
        {
          error: "stalled",
          message:
            "Translation isn't going through. Check that your API key is on file, then try again.",
          completed: 0,
          total: Number(job.total_items),
        },
        { status: 502 }
      );
    }

    // Most of it worked and a few specific items won't. Finish, and say how
    // many were left behind rather than reporting a clean success.
    await sql`
      UPDATE translation_jobs
      SET status = 'done', done_items = ${doneItems},
          failed_items = ${remaining.length},
          input_tokens = ${totalIn}, output_tokens = ${totalOut},
          updated_at = now()
      WHERE id = ${jobId}
    `;
    return NextResponse.json({
      done: true,
      status: "done",
      completed: doneItems,
      total: Number(job.total_items),
      failed: remaining.length,
    });
  }

  const stillLeft = remaining.length - result.done;
  const finished = stillLeft <= 0;

  await sql`
    UPDATE translation_jobs
    SET done_items = ${doneItems}, failed_items = ${failedItems},
        input_tokens = ${totalIn}, output_tokens = ${totalOut},
        status = ${finished ? "done" : "pending"}, updated_at = now()
    WHERE id = ${jobId}
  `;

  return NextResponse.json({
    done: finished,
    status: finished ? "done" : "pending",
    completed: doneItems,
    total: Number(job.total_items),
    failed: failedItems,
  });
}
