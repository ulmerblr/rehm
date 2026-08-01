import { cache } from "react";
import { getSql } from "@/lib/db";
import { getUserAnthropic } from "@/lib/keys";
import { translateText } from "@/lib/translate";
import { otherLang, type Lang, type SourceType } from "@/lib/lang";

export type LangSettings = { language: Lang; dual: boolean };

/**
 * The account's own language and whether it prepares both. Degrades to
 * English/single if migration 0018 hasn't landed yet, so every caller keeps
 * working through a deploy rather than throwing.
 */
export const getLangSettings = cache(async function getLangSettings(
  userId: string
): Promise<LangSettings> {
  const sql = getSql();
  try {
    const rows = (await sql`
      SELECT language, dual_language FROM users WHERE id = ${userId}
    `) as Array<{ language: string; dual_language: boolean }>;
    if (rows.length === 0) return { language: "en", dual: false };
    return {
      language: rows[0].language === "es" ? "es" : "en",
      dual: Boolean(rows[0].dual_language),
    };
  } catch {
    return { language: "en", dual: false };
  }
});

/** One text to translate, tagged with what it is and where it came from. */
export type Item = { type: SourceType; id: string; text: string };

/**
 * Translate a batch and store the results. Returns what it managed to do.
 *
 * Every failure is survivable by design: a missing translation shows the
 * original text instead. So this never throws to its caller — capture and
 * analysis must not be able to fail because a translation did.
 */
export async function translateAndStore(
  userId: string,
  items: Item[],
  target: Lang
): Promise<{ done: number; failed: number; usage: { input: number; output: number } }> {
  const usage = { input: 0, output: 0 };
  let done = 0;
  let failed = 0;
  if (items.length === 0) return { done, failed, usage };

  const got = await getUserAnthropic(userId);
  if ("error" in got) return { done, failed: items.length, usage };

  const sql = getSql();

  for (const item of items) {
    const result = await translateText(got.client, {
      text: item.text,
      type: item.type,
      target,
    });
    if (!result) {
      failed += 1;
      continue;
    }
    usage.input += result.usage.input;
    usage.output += result.usage.output;

    try {
      // ON CONFLICT DO NOTHING, not DO UPDATE: the table forbids UPDATE (0018),
      // and a translation that already exists is already paid for.
      await sql`
        INSERT INTO translations
          (user_id, source_type, source_id, target_lang, body, model, input_tokens, output_tokens)
        VALUES
          (${userId}, ${item.type}, ${item.id}, ${target}, ${result.body},
           ${result.model}, ${result.usage.input}, ${result.usage.output})
        ON CONFLICT (source_type, source_id, target_lang) DO NOTHING
      `;
      done += 1;
    } catch (err) {
      console.error("[rehm] translation write failed:", err);
      failed += 1;
    }
  }

  if (usage.input > 0 || usage.output > 0) {
    try {
      await sql`
        INSERT INTO usage_events (user_id, kind, input_tokens, output_tokens)
        VALUES (${userId}, 'translation', ${usage.input}, ${usage.output})
      `;
    } catch (err) {
      console.error("[rehm] translation usage write failed:", err);
    }
  }

  return { done, failed, usage };
}

/**
 * Prepare the counterpart of freshly generated text, if this account is
 * dual-language. Called at each of the four points where text is made.
 *
 * Awaited rather than fired and forgotten: a serverless function that returns
 * kills its own pending work, so a floating promise here would translate
 * nothing most of the time. It is wrapped so a failure can't reach the caller.
 */
export async function prepareCounterpart(
  userId: string,
  items: Item[]
): Promise<void> {
  try {
    const { language, dual } = await getLangSettings(userId);
    if (!dual) return;
    await translateAndStore(userId, items, otherLang(language));
  } catch (err) {
    console.error("[rehm] counterpart translation skipped:", err);
  }
}

/**
 * Look up stored translations for a set of sources, keyed "type:id".
 *
 * Returns an empty map — not an error — when the account is single-language,
 * when the view already matches, or when 0018 hasn't been applied. Callers
 * then render originals, which is the correct fallback in every case.
 */
export async function loadTranslations(
  userId: string,
  target: Lang,
  sources: Array<{ type: SourceType; id: string }>
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (sources.length === 0) return out;

  const ids = [...new Set(sources.map((s) => s.id))];
  const sql = getSql();
  try {
    const rows = (await sql`
      SELECT source_type, source_id, body
      FROM translations
      WHERE user_id = ${userId}
        AND target_lang = ${target}
        AND source_id = ANY (${ids}::uuid[])
    `) as Array<{ source_type: string; source_id: string; body: string }>;
    for (const r of rows) out.set(`${r.source_type}:${r.source_id}`, String(r.body));
  } catch {
    return out;
  }
  return out;
}

/** Key for the map returned by loadTranslations. */
export function tkey(type: SourceType, id: string): string {
  return `${type}:${id}`;
}

/**
 * Pick what to display: the translation when the view language differs from
 * the language the text was made in and we have one, otherwise the original.
 * `translated` tells the UI to mark it as machine words rather than said ones.
 */
export function display(
  original: string,
  translations: Map<string, string>,
  type: SourceType,
  id: string
): { text: string; translated: boolean } {
  const hit = translations.get(tkey(type, id));
  if (hit) return { text: hit, translated: true };
  return { text: original, translated: false };
}
