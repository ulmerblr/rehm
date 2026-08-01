/**
 * Locating a quoted passage inside the transcript it was lifted from.
 *
 * Two callers, one problem. An analysis quotes the dream verbatim inside its
 * prose; a trend claim carries its evidence as structured quotes. Either way we
 * are handed a string that is *supposed* to appear in a raw transcript, and we
 * have to find where — without ever trusting a position the model supplied.
 *
 * The ladder is deliberate and stops at the first rung that holds:
 *
 *   exact       indexOf. The quote is character-for-character in the source.
 *   normalized  curly quotes unified with straight, whitespace runs collapsed,
 *               case ignored, then mapped back to true offsets in the original.
 *   unresolved  no offsets. The quote is kept; nothing is fabricated.
 *
 * Offsets always index the ORIGINAL transcript, never the normalized copy, so a
 * highlight lands on the real characters the dreamer said.
 *
 * Silent failure is correct here. A quote that cannot be found renders as
 * ordinary text — no warning, no marker. The alternative is decorating an
 * analysis with error states over a stray apostrophe.
 */

export type MatchKind = "exact" | "normalized" | "unresolved";

export type Resolved = {
  /** Offsets into the ORIGINAL transcript. Null when unresolved. */
  start: number | null;
  end: number | null;
  kind: MatchKind;
};

/** Punctuation that an analysis routinely pulls inside its closing quote. */
const TRAILING = /[.,;:!?]+$/;

/**
 * Fold away the differences that don't change what was said.
 *
 * Returns the folded text alongside `map`, where map[i] is the index in the
 * source of the character that produced folded character i. That map is the
 * whole point: it is what lets a match found in folded space be reported as a
 * range in the real transcript.
 */
export function fold(source: string): { text: string; map: number[] } {
  const out: string[] = [];
  const map: number[] = [];
  let i = 0;
  let pendingSpace = false;

  while (i < source.length) {
    const ch = source[i];

    if (/\s/.test(ch)) {
      // A run of any whitespace — including newlines — becomes one space,
      // anchored at the first character of the run.
      const runStart = i;
      while (i < source.length && /\s/.test(source[i])) i++;
      // Leading whitespace is dropped rather than folded to a space, so a
      // transcript that begins with a newline doesn't shift every offset.
      if (out.length > 0) {
        pendingSpace = true;
        map.push(runStart);
        out.push(" ");
      }
      continue;
    }

    pendingSpace = false;
    out.push(foldChar(ch));
    map.push(i);
    i++;
  }

  // A trailing space is never part of a match worth keeping.
  if (pendingSpace && out[out.length - 1] === " ") {
    out.pop();
    map.pop();
  }

  return { text: out.join(""), map };
}

function foldChar(ch: string): string {
  switch (ch) {
    case "‘": // ‘
    case "’": // ’
    case "ʼ": // ʼ
    case "′": // ′
      return "'";
    case "“": // “
    case "”": // ”
    case "″": // ″
      return '"';
    case "–": // – en dash
    case "—": // — em dash
      return "-";
    case " ": // non-breaking space is handled by the whitespace branch
      return " ";
    default:
      return ch.toLowerCase();
  }
}

/**
 * Find `quote` inside `transcript`, returning offsets into the transcript.
 *
 * `folded` may be passed in when resolving many quotes against one transcript
 * — folding is linear in the transcript and there is no reason to redo it per
 * quote.
 */
export function resolveQuote(
  transcript: string,
  quote: string,
  folded?: { text: string; map: number[] }
): Resolved {
  const needle = quote.trim();
  if (!needle || !transcript) return { start: null, end: null, kind: "unresolved" };

  // Rung 1: it is simply there.
  const exact = transcript.indexOf(needle);
  if (exact >= 0) return { start: exact, end: exact + needle.length, kind: "exact" };

  // Rung 2: the same words, differently typed.
  const hay = folded ?? fold(transcript);
  const found = findFolded(hay, needle);
  if (found) return found;

  // The analysis pulled the sentence's punctuation inside its closing quote.
  // "ended up turning into a plane," is a real quote of a real passage that
  // reads "ended up turning into a plane" with the comma outside.
  const trimmed = needle.replace(TRAILING, "");
  if (trimmed && trimmed !== needle) {
    const bare = transcript.indexOf(trimmed);
    if (bare >= 0) return { start: bare, end: bare + trimmed.length, kind: "exact" };
    const foldedBare = findFolded(hay, trimmed);
    if (foldedBare) return foldedBare;
  }

  return { start: null, end: null, kind: "unresolved" };
}

function findFolded(
  hay: { text: string; map: number[] },
  needle: string
): Resolved | null {
  const f = fold(needle);
  if (!f.text) return null;
  const at = hay.text.indexOf(f.text);
  if (at < 0) return null;
  const start = hay.map[at];
  const lastFolded = at + f.text.length - 1;
  // The map points at the FIRST source character behind each folded one, so the
  // end of the range is that character plus itself — correct because every
  // folded character except a collapsed space is 1:1 with its source.
  const end = hay.map[lastFolded] + 1;
  if (typeof start !== "number" || typeof end !== "number") return null;
  return { start, end, kind: "normalized" };
}

/** One quoted passage found in a body of prose, with its place in that prose. */
export type Quotation = {
  /** The quoted text, without the surrounding quote marks. */
  text: string;
  /** Offsets into the body, INCLUDING the quote marks, so rendering can split. */
  start: number;
  end: number;
};

// A quotation longer than this is almost certainly two unpaired quote marks
// swallowing a paragraph, not a quote.
const MAX_QUOTE = 400;

/**
 * Every double-quoted passage in a body of prose, in order.
 *
 * Straight and curly pairs both count; an apostrophe never opens a quotation,
 * so single quotes are left alone entirely — "don't" would otherwise open one.
 */
export function extractQuotations(body: string): Quotation[] {
  const out: Quotation[] = [];
  let i = 0;
  while (i < body.length) {
    const ch = body[i];
    const closer = ch === '"' ? '"' : ch === "“" ? "”" : null;
    if (!closer) {
      i++;
      continue;
    }
    const close = body.indexOf(closer, i + 1);
    if (close < 0) break; // unpaired opener: nothing after it is a quotation
    const text = body.slice(i + 1, close);
    if (text.trim() && text.length <= MAX_QUOTE) {
      out.push({ text, start: i, end: close + 1 });
    }
    i = close + 1;
  }
  return out;
}

/** A body of prose cut into plain runs and resolved, clickable quotations. */
export type Segment =
  | { kind: "text"; text: string }
  | { kind: "quote"; text: string; start: number; end: number };

/**
 * Cut `body` into segments, making clickable only the quotations that were
 * found in `transcript`. Unresolved quotations come back as ordinary text —
 * including their quote marks, so the prose reads exactly as it was written.
 */
export function segmentByQuotations(body: string, transcript: string): Segment[] {
  const quotations = extractQuotations(body);
  if (quotations.length === 0) return body ? [{ kind: "text", text: body }] : [];

  const hay = fold(transcript);
  const out: Segment[] = [];
  let cursor = 0;

  for (const q of quotations) {
    const hit = resolveQuote(transcript, q.text, hay);
    if (hit.kind === "unresolved" || hit.start === null || hit.end === null) continue;
    if (q.start > cursor) out.push({ kind: "text", text: body.slice(cursor, q.start) });
    out.push({
      kind: "quote",
      text: body.slice(q.start, q.end),
      start: hit.start,
      end: hit.end,
    });
    cursor = q.end;
  }

  if (cursor < body.length) out.push({ kind: "text", text: body.slice(cursor) });
  return out;
}

/**
 * The same, for prose being read in translation.
 *
 * A translated analysis quotes the dream in the language it was translated
 * into, so its quotations cannot be found in a transcript that was never
 * translated. But the translation preserves the prose structure, so the nth
 * quotation of the translation is the nth quotation of the original — and the
 * original's quotations DO resolve.
 *
 * That correspondence is only trusted when the two bodies contain the same
 * number of quotations. If a translation merged two quotations or dropped one,
 * pairing by position would point a passage at the wrong words, and a citation
 * that lands somewhere plausible but wrong is worse than no citation at all.
 * So the check is strict and the failure is total: nothing becomes clickable.
 */
export function segmentTranslated(
  translated: string,
  original: string,
  transcript: string
): Segment[] {
  const here = extractQuotations(translated);
  const there = extractQuotations(original);
  if (here.length === 0 || here.length !== there.length) {
    return translated ? [{ kind: "text", text: translated }] : [];
  }

  const hay = fold(transcript);
  const out: Segment[] = [];
  let cursor = 0;

  for (let i = 0; i < here.length; i++) {
    const hit = resolveQuote(transcript, there[i].text, hay);
    if (hit.kind === "unresolved" || hit.start === null || hit.end === null) continue;
    const q = here[i];
    if (q.start > cursor) out.push({ kind: "text", text: translated.slice(cursor, q.start) });
    out.push({
      kind: "quote",
      text: translated.slice(q.start, q.end),
      start: hit.start,
      end: hit.end,
    });
    cursor = q.end;
  }

  if (cursor < translated.length) out.push({ kind: "text", text: translated.slice(cursor) });
  return out;
}

/**
 * A window of transcript around a span: roughly two sentences either side.
 *
 * Sentence detection here is deliberately crude — a dictated transcript is one
 * long run of speech and its punctuation is whatever the recognizer guessed. If
 * the crude rule finds nothing, the window falls back to a character budget,
 * which is always better than showing the passage with no surroundings.
 */
export function contextWindow(
  transcript: string,
  start: number,
  end: number,
  sentences = 2,
  charBudget = 320
): { start: number; end: number } {
  const before = backOverSentences(transcript, start, sentences, charBudget);
  const after = forwardOverSentences(transcript, end, sentences, charBudget);
  return { start: before, end: after };
}

function backOverSentences(text: string, from: number, want: number, budget: number): number {
  let found = 0;
  let i = from - 1;
  const floor = Math.max(0, from - budget * 2);
  while (i > floor) {
    if (/[.!?]/.test(text[i]) && (i + 1 >= text.length || /\s/.test(text[i + 1] ?? " "))) {
      found++;
      if (found >= want) return skipSpace(text, i + 1);
    }
    i--;
  }
  return Math.max(0, from - budget);
}

function forwardOverSentences(text: string, from: number, want: number, budget: number): number {
  let found = 0;
  let i = from;
  const ceiling = Math.min(text.length, from + budget * 2);
  while (i < ceiling) {
    if (/[.!?]/.test(text[i]) && (i + 1 >= text.length || /\s/.test(text[i + 1] ?? " "))) {
      found++;
      if (found >= want) return i + 1;
    }
    i++;
  }
  return Math.min(text.length, from + budget);
}

function skipSpace(text: string, i: number): number {
  while (i < text.length && /\s/.test(text[i])) i++;
  return i;
}
