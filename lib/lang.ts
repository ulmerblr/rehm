// The two languages this app speaks, and the one rule that governs them:
//
//     The ACCOUNT language decides what gets MADE.
//     The VIEW language decides what gets SHOWN.
//
// A Spanish account dictates, restates, and analyses in Spanish no matter what
// the screen is currently displaying. Flipping the view is a lens, not a
// setting — it never changes the corpus.

export const LANGS = ["en", "es"] as const;
export type Lang = (typeof LANGS)[number];

export const DEFAULT_LANG: Lang = "en";

/** The cookie carrying the temporary view language. Session-scoped on purpose. */
export const VIEW_LANG_COOKIE = "rehm_view_lang";

export function isLang(v: unknown): v is Lang {
  return v === "en" || v === "es";
}

export function asLang(v: unknown, fallback: Lang = DEFAULT_LANG): Lang {
  return isLang(v) ? v : fallback;
}

export function otherLang(l: Lang): Lang {
  return l === "en" ? "es" : "en";
}

/** What the language is called, in itself — a picker should never be in a language you don't read. */
export const LANG_ENDONYM: Record<Lang, string> = {
  en: "English",
  es: "Español",
};

/** BCP-47 tag for the <html lang> attribute and for dictation. */
export const LANG_TAG: Record<Lang, string> = {
  en: "en-US",
  es: "es-MX",
};

/** Full name, for prompting the translator. */
export const LANG_NAME: Record<Lang, string> = {
  en: "English",
  es: "Spanish",
};

/** Every kind of text that can be translated for display. */
export const SOURCE_TYPES = [
  "dream",
  "addendum",
  "title",
  "restatement",
  "analysis",
  "trend_summary",
  "trend_closing",
  "trend_claim",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

/**
 * Whether a piece of text is something the person said, or something the
 * machine wrote. It changes how the translation is produced and how it is
 * rendered — a translated transcript is machine words standing in for said
 * ones, and the design system must never let that pass as the record.
 */
export function isSaid(t: SourceType): boolean {
  return t === "dream" || t === "addendum";
}

/**
 * A price, at the precision an estimate deserves. Sub-dollar amounts read in
 * cents because "$0.21" invites a scrutiny the estimate can't support.
 */
export function formatUsd(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return "nothing";
  if (usd < 0.01) return "less than a cent";
  if (usd < 1) return `${Math.round(usd * 100)}¢`;
  return `$${usd.toFixed(2)}`;
}
