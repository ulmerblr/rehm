// The span resolver, tested against the shapes an analysis actually produces.
//
// Run with: npx tsx scripts/check-spans.ts
//
// Every assertion here is a real failure mode: a curly apostrophe where the
// transcript has a straight one, a line break in the middle of a quoted phrase,
// the sentence's comma pulled inside the closing quote, a quote that simply
// isn't there. The last of those must produce no offsets at all — a wrong
// highlight is worse than no highlight.

import {
  fold,
  resolveQuote,
  extractQuotations,
  segmentByQuotations,
  contextWindow,
  segmentTranslated,
} from "../lib/spans";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let fail = 0;
const is = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${label}${ok ? "" : `\n       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`}`
  );
};

// A transcript in the shape dictation actually leaves them: no paragraphing,
// straight apostrophes from the recognizer, run-on punctuation.
const T =
  "We were trying to, I can't remember, get somewhere. There was a truck that " +
  "ended up turning into a plane, which was strange. Everyone was getting into " +
  "accidents except us.";

// --- fold ------------------------------------------------------------------
is("fold collapses whitespace runs", fold("a   b\n\nc").text, "a b c");
is("fold maps back to source", fold("a   b").map, [0, 1, 4]);
is("fold unifies curly apostrophes", fold("can’t").text, "can't");
is("fold unifies curly quotes", fold("“x”").text, '"x"');
is("fold lowercases", fold("Whatever").text, "whatever");
is("fold drops leading whitespace", fold("   a b").text, "a b");
is("fold drops trailing whitespace", fold("a b   ").text, "a b");
is("fold of empty is empty", fold("").text, "");

// --- exact -----------------------------------------------------------------
{
  const r = resolveQuote(T, "Everyone was getting into accidents except us.");
  is("exact match kind", r.kind, "exact");
  is("exact match text", T.slice(r.start!, r.end!), "Everyone was getting into accidents except us.");
}

// --- normalized: curly apostrophe in the quote, straight in the transcript --
{
  const r = resolveQuote(T, "I can’t remember");
  is("curly apostrophe resolves", r.kind, "normalized");
  is("curly apostrophe lands on the real text", T.slice(r.start!, r.end!), "I can't remember");
}

// --- normalized: the quote arrives with its line breaks flattened ----------
{
  const wrapped = "There was a truck that\n   ended up turning\ninto a plane";
  const r = resolveQuote(T, wrapped);
  is("re-wrapped quote resolves", r.kind, "normalized");
  is(
    "re-wrapped quote lands on the real text",
    T.slice(r.start!, r.end!),
    "There was a truck that ended up turning into a plane"
  );
}

// --- normalized: the model capitalized the first word ----------------------
{
  const r = resolveQuote(T, "Which was strange");
  is("case difference resolves", r.kind, "normalized");
  is("case difference lands on the real text", T.slice(r.start!, r.end!), "which was strange");
}

// --- trailing punctuation pulled inside the closing quote ------------------
// The case that needs tolerating is a comma the TRANSCRIPT does not have. When
// the transcript does have it, the exact rung takes it and keeping it in the
// span is right, so this needs its own source to be a real test.
const T2 = "There was a truck that ended up turning into a plane and then it vanished";
{
  const r = resolveQuote(T2, "ended up turning into a plane,");
  is("trailing comma the source lacks is tolerated", r.kind, "exact");
  is(
    "trailing comma is not part of the span",
    T2.slice(r.start!, r.end!),
    "ended up turning into a plane"
  );
}
{
  // Same, one rung down: curly apostrophe AND a comma the source lacks.
  const T3 = "and I can't remember where we were going";
  const r = resolveQuote(T3, "I can’t remember,");
  is("folded plus tolerated comma resolves", r.kind, "normalized");
  is("folded plus tolerated comma lands right", T3.slice(r.start!, r.end!), "I can't remember");
}
{
  // The transcript really does end the clause with a comma, so it stays in.
  const r = resolveQuote(T, "ended up turning into a plane,");
  is("a comma the source has is kept", T.slice(r.start!, r.end!), "ended up turning into a plane,");
}
{
  // Both problems at once: curly apostrophe AND a trailing period.
  const r = resolveQuote(T, "I can’t remember.");
  is("curly plus trailing period resolves", r.kind, "normalized");
  is("curly plus trailing period lands right", T.slice(r.start!, r.end!), "I can't remember");
}

// --- unresolved must stay unresolved ---------------------------------------
{
  const r = resolveQuote(T, "a horse made entirely of glass");
  is("invented quote is unresolved", r, { start: null, end: null, kind: "unresolved" });
}
is("empty quote is unresolved", resolveQuote(T, "   ").kind, "unresolved");
is("empty transcript is unresolved", resolveQuote("", "anything").kind, "unresolved");

// --- extractQuotations -----------------------------------------------------
is(
  "straight quotes extracted in order",
  extractQuotations('He said "one" and then "two".').map((q) => q.text),
  ["one", "two"]
);
is(
  "curly quotes extracted",
  extractQuotations("He said “one”.").map((q) => q.text),
  ["one"]
);
is(
  "an apostrophe never opens a quotation",
  extractQuotations("It doesn't open anything.").map((q) => q.text),
  []
);
is("an unpaired opener yields nothing", extractQuotations('He said "one').map((q) => q.text), []);
is(
  "an over-long quotation is ignored",
  extractQuotations(`"${"x".repeat(500)}"`).map((q) => q.text),
  []
);
is("empty quotes are ignored", extractQuotations('a "" b').map((q) => q.text), []);

// --- segmentByQuotations ---------------------------------------------------
{
  const body =
    'The dream opens with "We were trying to, I can\'t remember, get somewhere." ' +
    'and later a vehicle "ended up turning into a plane," before it closes.';
  const segs = segmentByQuotations(body, T);
  is("both quotations became clickable", segs.filter((s) => s.kind === "quote").length, 2);
  is(
    "the segments rebuild the body exactly",
    segs.map((s) => s.text).join(""),
    body
  );
  const quotes = segs.filter((s) => s.kind === "quote") as Array<{ start: number; end: number }>;
  is(
    "first span points at the real passage",
    T.slice(quotes[0].start, quotes[0].end),
    "We were trying to, I can't remember, get somewhere."
  );
  is(
    "second span points at the real passage",
    T.slice(quotes[1].start, quotes[1].end),
    "ended up turning into a plane,"
  );
  is(
    "the clickable run keeps its quote marks",
    (segs.filter((s) => s.kind === "quote")[1] as { text: string }).text,
    '"ended up turning into a plane,"'
  );
}
{
  // An unresolved quotation stays as prose, quote marks and all.
  const body = 'It mentions "a horse made entirely of glass" which is not in the dream.';
  const segs = segmentByQuotations(body, T);
  is("unresolved quotation is not clickable", segs.filter((s) => s.kind === "quote").length, 0);
  is("unresolved body is rebuilt exactly", segs.map((s) => s.text).join(""), body);
}
{
  const segs = segmentByQuotations("No quotations at all.", T);
  is("prose with no quotations is one text run", segs, [
    { kind: "text", text: "No quotations at all." },
  ]);
}
is("empty body yields nothing", segmentByQuotations("", T), []);

// --- segmentTranslated -----------------------------------------------------
{
  const original = 'It opens with "I can\'t remember" and closes on "except us".';
  const translated = 'Empieza con "no me acuerdo" y termina en "menos nosotros".';
  const segs = segmentTranslated(translated, original, T);
  is("both translated quotations became clickable", segs.filter((s) => s.kind === "quote").length, 2);
  is("the translated body is rebuilt exactly", segs.map((s) => s.text).join(""), translated);
  const quotes = segs.filter((s) => s.kind === "quote") as Array<{ start: number; end: number; text: string }>;
  is("the clickable run shows the SPANISH text", quotes[0].text, '"no me acuerdo"');
  is(
    "but points at the ENGLISH passage that was said",
    T.slice(quotes[0].start, quotes[0].end),
    "I can't remember"
  );
}
{
  // A translation that lost a quotation must make nothing clickable.
  const original = 'It opens with "I can\'t remember" and closes on "except us".';
  const translated = "Empieza con una duda y termina en el grupo.";
  const segs = segmentTranslated(translated, original, T);
  is("a mismatched count clicks nothing", segs, [{ kind: "text", text: translated }]);
}
{
  const original = "No quotations here at all.";
  const translated = "Aquí no hay ninguna cita.";
  is("no quotations either side clicks nothing", segmentTranslated(translated, original, T), [
    { kind: "text", text: translated },
  ]);
}
{
  // Counts agree, but the original's quotation isn't in the transcript — the
  // pairing is fine and the resolution still fails, silently.
  const original = 'It mentions "a horse made of glass" once.';
  const translated = 'Menciona "un caballo de vidrio" una vez.';
  const segs = segmentTranslated(translated, original, T);
  is("unresolvable original clicks nothing", segs.filter((s) => s.kind === "quote").length, 0);
  is("unresolvable original still rebuilds", segs.map((s) => s.text).join(""), translated);
}

// --- contextWindow ---------------------------------------------------------
{
  const start = T.indexOf("ended up turning");
  const w = contextWindow(T, start, start + "ended up turning into a plane".length, 1);
  const slice = T.slice(w.start, w.end);
  is("window contains the passage", slice.includes("ended up turning into a plane"), true);
  is("window reaches back a sentence", slice.startsWith("There was a truck"), true);
  is("window is shorter than the whole transcript", slice.length < T.length, true);
}
{
  // A passage at the very start must not produce a negative window.
  const w = contextWindow(T, 0, 10, 2);
  is("window at the start clamps to zero", w.start, 0);
}
{
  const w = contextWindow(T, T.length - 5, T.length, 2);
  is("window at the end clamps to the length", w.end, T.length);
}
{
  // No sentence punctuation anywhere — the character budget has to carry it.
  const run = "a".repeat(1000);
  const w = contextWindow(run, 500, 510, 2, 100);
  is("budget fallback backwards", w.start, 400);
  is("budget fallback forwards", w.end, 610);
}

// --- the wall --------------------------------------------------------------
// Spans are evidence pointers, not input. Nothing that builds a prompt may read
// them, or a later trend pass would be reasoning about its own earlier output
// — which is the one thing the whole design refuses to do. This is cheap to
// break by accident and expensive to notice, so it is asserted.
{
  const readsSpans = [
    "lib/prompts.ts",
    "lib/translations.ts",
    "app/api/dreams/[id]/analyze/route.ts",
    "app/api/restatements/[id]/propose/route.ts",
    "app/api/trends/jobs/route.ts",
  ].filter((f) => {
    try {
      return readFileSync(join(__dirname, "..", f), "utf8").includes("trend_claim_spans");
    } catch {
      return false;
    }
  });
  is("no prompt path reads the span table", readsSpans, []);

  // The trend step DOES touch the table — it writes the spans — but must only
  // ever insert. A SELECT there would be the same leak by a slower route.
  const step = readFileSync(
    join(__dirname, "..", "app/api/trends/jobs/[id]/step/route.ts"),
    "utf8"
  );
  const spanStatements = (step.match(/(?:INSERT INTO|SELECT[\s\S]{0,200}?FROM)\s+trend_claim_spans/g) ?? []);
  is("the trend step only inserts spans", spanStatements, ["INSERT INTO trend_claim_spans"]);
}

console.log(fail === 0 ? "\nall pass" : `\n${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
