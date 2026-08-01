// Language wiring checks. Run from the repo root:
//   npx tsx scripts/check-i18n.ts
//
// Guards three things that have each already broken once:
//   1. Dictionary parity — every English key present, non-empty, and actually
//      different in Spanish. A line left in English is invisible otherwise.
//   2. Source-type wiring — every translatable kind of text is prepared when
//      it's made, found by the backfill, and rendered through display().
//   3. No generated text rendered straight from the row.
import { asLang, otherLang, isLang, isSaid, LANG_TAG, LANG_ENDONYM, SOURCE_TYPES } from "../lib/lang";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Resolve against the repo, not the shell's working directory.
const ROOT = join(__dirname, "..");
const read = (f: string) => readFileSync(join(ROOT, f), "utf8");
import { dict, type Dict } from "../lib/i18n";
import { estimateTokens, estimateUsd } from "../lib/translate";
import { display, tkey } from "../lib/translations";
import { formatUsd } from "../lib/lang";

let fail = 0;
const is = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${ok ? "" : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
};

// --- language primitives ---
is("otherLang en->es", otherLang("en"), "es");
is("otherLang es->en", otherLang("es"), "en");
is("otherLang is an involution", otherLang(otherLang("es")), "es");
is("asLang rejects junk", asLang("fr"), "en");
is("asLang rejects junk with fallback", asLang(undefined, "es"), "es");
is("asLang passes valid", asLang("es", "en"), "es");
is("isLang", [isLang("en"), isLang("es"), isLang("EN"), isLang(null)], [true, true, false, false]);
is("said vs machine", [isSaid("dream"), isSaid("addendum"), isSaid("analysis"), isSaid("title")], [true, true, false, false]);
is("dictation tags differ", LANG_TAG.en !== LANG_TAG.es, true);
is("endonyms are self-named", [LANG_ENDONYM.en, LANG_ENDONYM.es], ["English", "Español"]);

// --- dictionary completeness: es must cover every key en has ---
const en = dict("en") as unknown as Record<string, unknown>;
const es = dict("es") as unknown as Record<string, unknown>;
const enKeys = Object.keys(en).sort();
const esKeys = Object.keys(es).sort();
is("same key set", esKeys, enKeys);

const missing = enKeys.filter((k) => es[k] === undefined || es[k] === null || es[k] === "");
is("no empty Spanish values", missing, []);

const sameType = enKeys.filter((k) => typeof en[k] !== typeof es[k]);
is("matching value types", sameType, []);

// Nothing should be left in English by accident: no Spanish string may be
// byte-identical to its English counterpart unless it genuinely is a shared word.
const SHARED_OK = new Set(["inputTokens", "outputTokens"]);
const untranslated = enKeys.filter(
  (k) => typeof en[k] === "string" && en[k] === es[k] && !SHARED_OK.has(k)
);
is("no untranslated strings", untranslated, []);

// Arrays (month names) must differ and be complete.
const arrKeys = enKeys.filter((k) => Array.isArray(en[k]));
const arrBad = arrKeys.filter((k) => {
  const a = en[k] as string[];
  const b = es[k] as string[];
  return a.length !== b.length || b.some((x) => !x) || a.join() === b.join();
});
is("array entries translated and same length", arrBad, []);
is("twelve months", (en.months as string[]).length, 12);

// Every function entry must produce different text per language. Probed with
// arguments each one can actually take — a date formatter needs an ISO string,
// not the integer a counter takes.
const ARGS: Record<string, unknown[]> = {
  formatDate: ["2026-08-01"],
  backfillPrompt: [3, "50¢"],
  backfillRunning: [2, 9],
  inThisPass: ["All dreams", 3],
  readingBatch: [1, 4],
  readPlusNote: [3],
  dreamsPrefix: ["8-10"],
  since: ["Aug 1, 2026"],
  upTo: ["Aug 1, 2026"],
  addedOn: ["Aug 1, 2026"],
  viewIn: ["English"],
};
const fnKeys = enKeys.filter((k) => typeof en[k] === "function");
const fnSame: string[] = [];
const fnThrew: string[] = [];
for (const k of fnKeys) {
  const args = (ARGS[k] ?? [3]) as never[];
  try {
    const a = (en[k] as (...x: never[]) => string)(...args);
    const b = (es[k] as (...x: never[]) => string)(...args);
    if (a === b) fnSame.push(k);
    if (typeof a !== "string" || !a) fnThrew.push(k);
  } catch {
    fnThrew.push(k);
  }
}
is("function entries differ by language", fnSame, []);
is("no function entry throws or returns empty", fnThrew, []);

// Dates read naturally in each language: month-first in English, day-first in Spanish.
is("en date", dict("en").formatDate("2026-08-01"), "Aug 1, 2026");
is("es date", dict("es").formatDate("2026-08-01"), "1 ago 2026");
is("date tolerates a timestamp", dict("en").formatDate("2026-08-01T10:20:00Z"), "Aug 1, 2026");
is("date tolerates junk", dict("en").formatDate("nope"), "nope");

// --- pluralization actually branches ---
const d = dict("en");
is("en 1 dream singular", d.dreamsRecorded(1), "dream recorded");
is("en 2 dreams plural", d.dreamsRecorded(2), "dreams recorded");
is("en 1 day", d.days(1), "1 day");
is("en 3 days", d.days(3), "3 days");
is("en 1 unanalyzed", d.notAnalyzedCount(1), "1 dream not analyzed");
is("en 4 unanalyzed", d.notAnalyzedCount(4), "4 dreams not analyzed");
const e = dict("es");
is("es 1 sueño singular", e.dreamsRecorded(1), "sueño registrado");
is("es 2 sueños plural", e.dreamsRecorded(2), "sueños registrados");
is("es 1 día", e.days(1), "1 día");
is("es 5 días", e.days(5), "5 días");
is("es 1 sin analizar", e.notAnalyzedCount(1), "1 sueño sin analizar");
is("es 4 sin analizar", e.notAnalyzedCount(4), "4 sueños sin analizar");
is("es 1 sin fecha", e.undated(1), "1 sin fecha");
is("es 3 sin fecha", e.undated(3), "3 sin fecha");

// --- display resolution ---
const map = new Map<string, string>([[tkey("dream", "abc"), "el sueño"]]);
is("shows translation when present", display("the dream", map, "dream", "abc"), { text: "el sueño", translated: true });
is("falls back to original", display("the dream", map, "dream", "zzz"), { text: "the dream", translated: false });
is("wrong type does not collide", display("Title", map, "title", "abc"), { text: "Title", translated: false });
is("empty map falls back", display("x", new Map(), "analysis", "abc"), { text: "x", translated: false });

// --- cost estimate: sanity and monotonicity ---
const t1 = estimateTokens(["hello world"]);
const t2 = estimateTokens(["hello world", "hello world"]);
is("estimate grows with input", t2.input > t1.input, true);
is("output allows for Spanish being longer", t1.output >= t1.input, true);
is("empty corpus costs nothing", estimateUsd(estimateTokens([])), 0);
is("nulls tolerated", estimateTokens(["a", "", "b"]).input > 0, true);

// His actual corpus: ~30k tokens of text. Should land near the 20¢ I quoted.
const big = estimateTokens([("x".repeat(3200))].concat(Array(29).fill("x".repeat(3200))));
const usd = estimateUsd(big);
console.log(`     30k-token corpus -> ${big.input} in / ${big.output} out = $${usd.toFixed(3)}`);
is("30k corpus is cents, not dollars", usd > 0.05 && usd < 0.5, true);

is("formatUsd sub-cent", formatUsd(0.004), "less than a cent");
is("formatUsd cents", formatUsd(0.2), "20¢");
is("formatUsd dollars", formatUsd(1.62), "$1.62");
is("formatUsd zero", formatUsd(0), "nothing");

// Every kind of text the app can translate must ALSO be findable by the
// backfill and rendered through display(). A source type registered but never
// queried is exactly how the trend summary shipped untranslated: new passes
// would have had it, everything already recorded never would.
const backfill = read("lib/backfill.ts");
const missingFromBackfill = SOURCE_TYPES.filter((t) => !backfill.includes(`'${t}'`));
is("every source type has a backfill query", missingFromBackfill, []);

// And must actually reach a screen. Grep the pages for a display() call naming it.
const pages = [
  "app/page.tsx",
  "app/dreams/page.tsx",
  "app/dreams/[id]/page.tsx",
  "app/trends/page.tsx",
].map(read).join("\n");
const missingFromPages = SOURCE_TYPES.filter((t) => !pages.includes(`"${t}"`));
is("every source type is rendered somewhere", missingFromPages, []);

// And is prepared when the text is first made, so a fresh account never needs
// a backfill to catch up.
const triggers = [
  "app/api/dreams/route.ts",
  "app/api/dreams/[id]/analyze/route.ts",
  "app/api/dreams/[id]/addenda/route.ts",
  "app/api/dreams/[id]/title/route.ts",
  "app/api/restatements/[id]/accept/route.ts",
  "app/api/trends/jobs/[id]/step/route.ts",
].map(read).join("\n");
const missingFromTriggers = SOURCE_TYPES.filter((t) => !triggers.includes(`"${t}"`));
is("every source type is prepared at generation", missingFromTriggers, []);

// The trend summary shipped untranslated because the page rendered the field
// straight from the row. Any generated text put on screen without going
// through display() has the same bug waiting in it.
//
// Only JSX text positions count. `${x}` inside a template literal is the
// plain-text export, which is deliberately the original, and `prop={x}` hands
// the raw value to a component that wants it — neither is a render.
const RAW_RENDERS: Array<[string, string]> = [
  ["app/trends/page.tsx", "run.body"],
  ["app/trends/page.tsx", "run.closing"],
  ["app/trends/page.tsx", "c.claim"],
  ["app/dreams/[id]/page.tsx", "a.body"],
  ["app/dreams/[id]/page.tsx", "dream.rawTranscript"],
  ["app/dreams/page.tsx", "d.title"],
  ["app/dreams/page.tsx", "d.snippet"],
];
const rawFound = RAW_RENDERS.filter(([f, field]) => {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![$=])\\{\\s*${escaped}\\s*\\}`).test(read(f));
}).map(([f, field]) => `${f}: {${field}}`);
is("no generated text rendered without display()", rawFound, []);

// The matcher has to actually fire, or it is decoration. Prove it catches a
// bare render and ignores the two shapes that legitimately look like one.
const probe = (src: string, field: string) => {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![$=])\\{\\s*${escaped}\\s*\\}`).test(src);
};
is("matcher catches a bare render", probe("<p>{run.body}</p>", "run.body"), true);
is("matcher ignores a template literal", probe("`x ${run.body}`", "run.body"), false);
is("matcher ignores a prop", probe("<X initial={run.body} />", "run.body"), false);
is("matcher ignores a display() call", probe("{display(run.body, tr, \"trend_summary\", id).text}", "run.body"), false);

console.log(fail === 0 ? "\nall passed" : `\n${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
