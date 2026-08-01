import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One dream's raw transcript, for the citation modal.
 *
 * Fetched on demand rather than shipped with the page: a trend report can cite
 * twenty dreams, and sending twenty transcripts to render a report nobody may
 * tap is a large cost for a small chance. The client keeps what it fetches, so
 * reopening the same dream is free.
 *
 * Always the original, never a translation. The modal exists to show what was
 * actually said, and the offsets it highlights index this exact string.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "not found" }, { status: 404 });

  const rows = (await getSql()`
    SELECT sequence_no, dreamt_on, raw_transcript
    FROM dreams WHERE id = ${id} AND user_id = ${userId}
  `) as Array<{ sequence_no: number; dreamt_on: unknown; raw_transcript: string }>;
  if (rows.length === 0) return NextResponse.json({ error: "not found" }, { status: 404 });

  const d = rows[0];
  return NextResponse.json({
    sequenceNo: Number(d.sequence_no),
    dreamtOn:
      d.dreamt_on instanceof Date
        ? d.dreamt_on.toISOString().slice(0, 10)
        : d.dreamt_on == null
          ? null
          : String(d.dreamt_on).slice(0, 10),
    text: String(d.raw_transcript),
  });
}
