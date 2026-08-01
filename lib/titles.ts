import type Anthropic from "@anthropic-ai/sdk";
import { TITLE_MODEL } from "@/lib/config";
import { TITLE_PROMPT } from "@/lib/prompts";
import { textOf, usageOf } from "@/lib/anthropic";

// Longest title that reliably fits on one line in the phone list without being
// ellipsed. Enforced here rather than trusted to the prompt.
const MAX_TITLE_CHARS = 30;

// Words that stay lowercase inside a title — capitalizing them reads as a
// headline generator rather than a title ("Toxic Gold and Sick Father", not
// "... And ..."). First and last word are always capitalized regardless.
const MINOR = new Set([
  "a", "an", "and", "as", "at", "but", "by", "for", "from", "in", "into", "nor",
  "of", "on", "onto", "or", "over", "per", "so", "the", "to", "up", "via", "vs",
  "with", "yet",
]);

// Capitalize the first letter of each significant word, leaving the rest of the
// word alone so acronyms and names keep their casing.
function toTitleCase(s: string): string {
  const words = s.split(/(\s+)/); // keep separators
  const lastIndex = words.length - 1;
  return words
    .map((w, i) => {
      if (!w.trim()) return w;
      const lower = w.toLowerCase();
      if (i !== 0 && i !== lastIndex && MINOR.has(lower)) return lower;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join("");
}

// Clean the model's reply into a bare title: single line, no surrounding quotes,
// no trailing punctuation, Title Cased, and short enough to display whole.
function clean(raw: string): string {
  let t = String(raw).replace(/\s+/g, " ").trim();
  t = t.replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").trim();
  t = t.replace(/[.!?,;:]+$/g, "").trim();

  // Trim whole words off the end until it fits — never mid-word, and no
  // ellipsis: a title that fits is the point.
  while (t.length > MAX_TITLE_CHARS && t.includes(" ")) {
    t = t.replace(/\s+\S+$/, "");
  }
  if (t.length > MAX_TITLE_CHARS) t = t.slice(0, MAX_TITLE_CHARS).trim();

  return toTitleCase(t);
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
