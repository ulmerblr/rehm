import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { getSql } from "@/lib/db";
import { getAnthropic, textOf } from "@/lib/anthropic";
import { MODEL } from "@/lib/config";
import { RESTATEMENT_CONTRACT } from "@/lib/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Generate the next proposal. If an objection is supplied it is stored first,
// then a new proposal is generated from the raw transcript PLUS all prior turns
// (the only place the app feeds generated output back into generation).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: restatementId } = await params;
  const body = (await req.json().catch(() => ({}))) as { objection?: string };
  const objection = (body.objection ?? "").trim();

  const sql = getSql();

  const restRows = (await sql`
    SELECT r.accepted, r.dream_id, d.raw_transcript
    FROM restatements r
    JOIN dreams d ON d.id = r.dream_id
    WHERE r.id = ${restatementId}
  `) as Array<{ accepted: boolean; dream_id: string; raw_transcript: string }>;
  if (restRows.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (restRows[0].accepted) {
    return NextResponse.json({ error: "restatement is accepted (locked)" }, { status: 409 });
  }
  const raw = restRows[0].raw_transcript;

  const turnRows = (await sql`
    SELECT turn_no, role, body FROM restatement_turns
    WHERE restatement_id = ${restatementId}
    ORDER BY turn_no ASC
  `) as Array<{ turn_no: number; role: "proposal" | "objection"; body: string }>;

  let nextTurnNo = turnRows.reduce((m, t) => Math.max(m, Number(t.turn_no)), 0) + 1;

  if (objection) {
    if (turnRows.length === 0) {
      return NextResponse.json({ error: "nothing to object to yet" }, { status: 400 });
    }
    await sql`
      INSERT INTO restatement_turns (restatement_id, turn_no, role, body)
      VALUES (${restatementId}, ${nextTurnNo}, 'objection', ${objection})
    `;
    turnRows.push({ turn_no: nextTurnNo, role: "objection", body: objection });
    nextTurnNo += 1;
  }

  // Build the conversation: raw transcript, then each prior proposal (assistant)
  // and objection (user), ending on the latest objection so the model produces
  // the next proposal.
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Here is the raw spoken dream transcript. Restate it following every rule.\n\n<transcript>\n${raw}\n</transcript>`,
    },
  ];
  for (const t of turnRows) {
    if (t.role === "proposal") {
      messages.push({ role: "assistant", content: t.body });
    } else {
      messages.push({
        role: "user",
        content: `That restatement is wrong: ${t.body}\n\nRestate again, fixing this while still following every rule.`,
      });
    }
  }

  const client = getAnthropic();
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: RESTATEMENT_CONTRACT,
    messages,
  });
  if (message.stop_reason === "refusal") {
    return NextResponse.json({ error: "model declined the request" }, { status: 502 });
  }
  const proposal = textOf(message);
  if (!proposal) {
    return NextResponse.json({ error: "empty proposal" }, { status: 502 });
  }

  await sql`
    INSERT INTO restatement_turns (restatement_id, turn_no, role, body)
    VALUES (${restatementId}, ${nextTurnNo}, 'proposal', ${proposal})
  `;

  return NextResponse.json({ proposal, turnNo: nextTurnNo });
}
