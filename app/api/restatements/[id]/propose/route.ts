import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { getSql } from "@/lib/db";
import { textOf, usageOf } from "@/lib/anthropic";
import { MODEL } from "@/lib/config";
import { RESTATEMENT_CONTRACT } from "@/lib/prompts";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { getUserAnthropic, markKeyVerified } from "@/lib/keys";
import { userFacingAnthropicError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// This route calls the model, which runs well past the platform default (~10-15s).
export const maxDuration = 60;

const NO_KEY = {
  error: "no_key",
  message: "Add your Anthropic API key in Settings to generate a restatement.",
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: restatementId } = await params;
  const reqBody = (await req.json().catch(() => ({}))) as { objection?: string };
  const objection = (reqBody.objection ?? "").trim();

  const sql = getSql();

  // Ownership + state.
  const restRows = (await sql`
    SELECT r.accepted, d.user_id, d.raw_transcript
    FROM restatements r JOIN dreams d ON d.id = r.dream_id
    WHERE r.id = ${restatementId}
  `) as Array<{ accepted: boolean; user_id: string; raw_transcript: string }>;
  if (restRows.length === 0 || restRows[0].user_id !== userId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (restRows[0].accepted) {
    return NextResponse.json({ error: "restatement is accepted (locked)" }, { status: 409 });
  }
  const raw = restRows[0].raw_transcript;

  const turns = (await sql`
    SELECT turn_no, role, body FROM restatement_turns
    WHERE restatement_id = ${restatementId} ORDER BY turn_no ASC
  `) as Array<{ turn_no: number; role: "proposal" | "objection"; body: string }>;
  const proposalCount = turns.filter((t) => t.role === "proposal").length;

  if (objection && turns.length === 0) {
    return NextResponse.json({ error: "nothing to object to yet" }, { status: 400 });
  }
  if (!objection && proposalCount > 0) {
    return NextResponse.json(
      { error: "disagree to get a new proposal" },
      { status: 400 }
    );
  }

  // Build the conversation (stored turns + the new objection in memory — nothing
  // is written until the proposal succeeds, so a failed call leaves no partial).
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Here is the raw spoken dream transcript. Restate it following every rule.\n\n<transcript>\n${raw}\n</transcript>`,
    },
  ];
  for (const t of turns) {
    if (t.role === "proposal") messages.push({ role: "assistant", content: t.body });
    else
      messages.push({
        role: "user",
        content: `That restatement is wrong: ${t.body}\n\nRestate again, fixing this while still following every rule.`,
      });
  }
  if (objection) {
    messages.push({
      role: "user",
      content: `That restatement is wrong: ${objection}\n\nRestate again, fixing this while still following every rule.`,
    });
  }

  const got = await getUserAnthropic(userId);
  if ("error" in got) return NextResponse.json(NO_KEY, { status: 400 });

  let proposal: string;
  let usage: { input: number; output: number };
  try {
    const message = await got.client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: RESTATEMENT_CONTRACT,
      messages,
    });
    if (message.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "refusal", message: "The model declined this request." },
        { status: 502 }
      );
    }
    proposal = textOf(message);
    usage = usageOf(message);
    if (!proposal) throw new Error("empty");
  } catch (err) {
    const m = userFacingAnthropicError(err);
    return NextResponse.json({ error: "llm", message: m.message, detail: m.detail }, { status: m.status });
  }

  const baseNo = turns.reduce((n, t) => Math.max(n, Number(t.turn_no)), 0);
  const proposalNo = objection ? baseNo + 2 : baseNo + 1;

  const objectionWrite = objection
    ? [
        sql`INSERT INTO restatement_turns (restatement_id, turn_no, role, body)
            VALUES (${restatementId}, ${baseNo + 1}, 'objection', ${objection})`,
      ]
    : [];

  await sql.transaction([
    ...objectionWrite,
    sql`INSERT INTO restatement_turns (restatement_id, turn_no, role, body)
        VALUES (${restatementId}, ${proposalNo}, 'proposal', ${proposal})`,
    sql`UPDATE restatements
        SET input_tokens = coalesce(input_tokens, 0) + ${usage.input},
            output_tokens = coalesce(output_tokens, 0) + ${usage.output}
        WHERE id = ${restatementId}`,
    // Permanent spend record — survives deletion of the dream (0009).
    sql`INSERT INTO usage_events (user_id, kind, input_tokens, output_tokens, billed_to)
        VALUES (${userId}, 'restatement', ${usage.input}, ${usage.output}, ${got.billedTo})`,
  ]);
  await markKeyVerified(got.keyId);

  return NextResponse.json({ proposal, turnNo: proposalNo });
}
