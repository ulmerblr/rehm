import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { textOf, usageOf } from "@/lib/anthropic";
import { MODEL } from "@/lib/config";
import { ANALYSIS_PROMPT, ANALYSIS_PROMPT_VERSION } from "@/lib/prompts";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { getUserAnthropic, markKeyVerified } from "@/lib/keys";
import { userFacingAnthropicError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Blind analysis from the raw transcript ONLY. Re-runnable; new row each time.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id: dreamId } = await params;
  const sql = getSql();

  const rows = (await sql`
    SELECT raw_transcript FROM dreams WHERE id = ${dreamId} AND user_id = ${userId}
  `) as Array<{ raw_transcript: string }>;
  if (rows.length === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
  const raw = rows[0].raw_transcript;

  const got = await getUserAnthropic(userId);
  if ("error" in got) {
    return NextResponse.json(
      { error: "no_key", message: "Add your Anthropic API key in Settings to run an analysis." },
      { status: 400 }
    );
  }

  let analysis: string;
  let usage: { input: number; output: number };
  try {
    const message = await got.client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: ANALYSIS_PROMPT,
      messages: [{ role: "user", content: raw }],
    });
    if (message.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "refusal", message: "The model declined this request." },
        { status: 502 }
      );
    }
    if (message.stop_reason === "max_tokens") {
      return NextResponse.json(
        { error: "truncated", message: "The analysis was cut off. Try running it again." },
        { status: 502 }
      );
    }
    analysis = textOf(message);
    usage = usageOf(message);
    if (!analysis) throw new Error("empty");
  } catch (err) {
    const m = userFacingAnthropicError(err);
    return NextResponse.json({ error: "llm", message: m.message }, { status: m.status });
  }

  const [row] = (await sql`
    INSERT INTO analyses (dream_id, body, model, prompt_version, blind, input_tokens, output_tokens)
    VALUES (${dreamId}, ${analysis}, ${MODEL}, ${ANALYSIS_PROMPT_VERSION}, true, ${usage.input}, ${usage.output})
    RETURNING id
  `) as Array<{ id: string }>;
  // Permanent spend record — survives deletion of the dream (0009).
  await sql`
    INSERT INTO usage_events (user_id, kind, input_tokens, output_tokens)
    VALUES (${userId}, 'analysis', ${usage.input}, ${usage.output})
  `;
  await markKeyVerified(got.keyId);

  return NextResponse.json({ id: row.id });
}
