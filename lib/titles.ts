import type Anthropic from "@anthropic-ai/sdk";
import { TITLE_MODEL } from "@/lib/config";
import { TITLE_PROMPT } from "@/lib/prompts";
import { textOf, usageOf } from "@/lib/anthropic";

// Clean the model's reply into a bare title: single line, no surrounding quotes,
// no trailing punctuation, hard length cap.
function clean(raw: string): string {
  let t = String(raw).replace(/\s+/g, " ").trim();
  t = t.replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").trim();
  t = t.replace(/[.!?,;:]+$/g, "").trim();
  if (t.length > 72) t = t.slice(0, 72).replace(/\s+\S*$/, "").trim();
  return t;
}

// Best-effort short title for the dream list. Uses the cheap TITLE_MODEL and
// only the first stretch of the transcript (titles don't need the whole thing).
// Returns null on anything unexpected — the caller must treat a title as
// optional so capture never depends on it.
export async function generateTitle(
  client: Anthropic,
  rawTranscript: string
): Promise<{ title: string; usage: { input: number; output: number } } | null> {
  try {
    const message = await client.messages.create({
      model: TITLE_MODEL,
      max_tokens: 24,
      system: TITLE_PROMPT,
      messages: [{ role: "user", content: rawTranscript.slice(0, 2000) }],
    });
    if (message.stop_reason === "refusal") return null;
    const title = clean(textOf(message));
    if (!title) return null;
    return { title, usage: usageOf(message) };
  } catch {
    return null;
  }
}
