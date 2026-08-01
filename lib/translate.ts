import type Anthropic from "@anthropic-ai/sdk";
import { TRANSLATION_MODEL } from "@/lib/config";
import {
  TRANSLATION_MACHINE,
  TRANSLATION_SAID,
  TRANSLATION_TITLE,
} from "@/lib/prompts";
import { textOf, usageOf } from "@/lib/anthropic";
import { LANG_NAME, isSaid, type Lang, type SourceType } from "@/lib/lang";

export type Translated = {
  body: string;
  model: string;
  usage: { input: number; output: number };
};

// Output is roughly the length of the input, so the ceiling scales with the
// source rather than being a flat guess. Spanish runs longer than English —
// the 1.6x headroom covers that plus punctuation drift, and the floor keeps
// short titles from being capped at something absurd.
function ceilingFor(text: string): number {
  const approxTokens = Math.ceil(text.length / 3.2);
  return Math.min(16000, Math.max(256, Math.ceil(approxTokens * 1.6)));
}

function systemFor(type: SourceType): string {
  if (type === "title") return TRANSLATION_TITLE;
  return isSaid(type) ? TRANSLATION_SAID : TRANSLATION_MACHINE;
}

/**
 * Translate one piece of text for display.
 *
 * Deliberately on the cheap model: this is a mechanical task between two
 * high-resource languages, and it runs on every piece of text the app
 * generates. Opus costs five times as much for work it is not better at.
 *
 * Returns null on anything unexpected — a missing translation degrades to
 * showing the original, which is always correct, just not in your language.
 * Nothing about capture or analysis may depend on this succeeding.
 */
export async function translateText(
  client: Anthropic,
  args: { text: string; type: SourceType; target: Lang }
): Promise<Translated | null> {
  const text = String(args.text ?? "").trim();
  if (!text) return null;

  try {
    const message = await client.messages.create({
      model: TRANSLATION_MODEL,
      max_tokens: ceilingFor(text),
      system: systemFor(args.type),
      messages: [
        {
          role: "user",
          content: `Translate the following into ${LANG_NAME[args.target]}.\n\n${text}`,
        },
      ],
    });

    // A refusal or a truncation both mean we do not have a faithful whole. A
    // half-translation is worse than none: it would read as complete.
    if (message.stop_reason === "refusal") return null;
    if (message.stop_reason === "max_tokens") return null;

    const body = textOf(message).trim();
    if (!body) return null;

    return { body, model: TRANSLATION_MODEL, usage: usageOf(message) };
  } catch {
    return null;
  }
}

// Rough token estimate for the cost preview shown before a backfill runs. This
// never calls the API — it is arithmetic on character counts, so quoting a
// price costs nothing. Deliberately an over-estimate: a bill that comes in
// under the quote is a good surprise.
export function estimateTokens(texts: string[]): { input: number; output: number } {
  const chars = texts.reduce((n, t) => n + (t ? t.length : 0), 0);
  const input = Math.ceil(chars / 3.2);
  return { input, output: Math.ceil(input * 1.2) };
}

// Haiku 4.5: $1 per million input tokens, $5 per million output.
const USD_PER_INPUT_TOKEN = 1 / 1_000_000;
const USD_PER_OUTPUT_TOKEN = 5 / 1_000_000;

export function estimateUsd(t: { input: number; output: number }): number {
  return t.input * USD_PER_INPUT_TOKEN + t.output * USD_PER_OUTPUT_TOKEN;
}
