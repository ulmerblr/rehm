import { getSql } from "@/lib/db";
import { estimateTokens, estimateUsd } from "@/lib/translate";
import type { Item } from "@/lib/translations";
import type { Lang } from "@/lib/lang";

/**
 * Everything already recorded that has no translation into `target` yet.
 *
 * Ordered by what you would actually hand someone the phone for: trend passes
 * first (few, and the highest-value thing to share), then analyses, then the
 * transcripts — which are the most tokens and the least likely to be read
 * aloud. That way the useful half is ready early even if the run is long.
 *
 * The NOT EXISTS makes this idempotent: anything already translated simply
 * isn't returned, so a re-run after a partial failure picks up where it
 * stopped and never pays twice for the same text.
 */
export async function pendingItems(userId: string, target: Lang): Promise<Item[]> {
  const sql = getSql();
  const out: Item[] = [];

  const closings = (await sql`
    SELECT r.id, r.closing AS body
    FROM trend_runs r
    WHERE r.user_id = ${userId}
      AND r.closing IS NOT NULL AND btrim(r.closing) <> ''
      AND NOT EXISTS (
        SELECT 1 FROM translations t
        WHERE t.source_type = 'trend_closing' AND t.source_id = r.id
          AND t.target_lang = ${target})
    ORDER BY r.created_at DESC
  `) as Array<{ id: string; body: string }>;
  for (const r of closings) out.push({ type: "trend_closing", id: String(r.id), text: String(r.body) });

  const claims = (await sql`
    SELECT c.id, c.claim AS body
    FROM trend_claims c JOIN trend_runs r ON r.id = c.trend_run_id
    WHERE r.user_id = ${userId}
      AND NOT EXISTS (
        SELECT 1 FROM translations t
        WHERE t.source_type = 'trend_claim' AND t.source_id = c.id
          AND t.target_lang = ${target})
    ORDER BY r.created_at DESC, c.created_at ASC
  `) as Array<{ id: string; body: string }>;
  for (const c of claims) out.push({ type: "trend_claim", id: String(c.id), text: String(c.body) });

  const analyses = (await sql`
    SELECT a.id, a.body
    FROM analyses a JOIN dreams d ON d.id = a.dream_id
    WHERE d.user_id = ${userId}
      AND a.body IS NOT NULL AND btrim(a.body) <> ''
      AND NOT EXISTS (
        SELECT 1 FROM translations t
        WHERE t.source_type = 'analysis' AND t.source_id = a.id
          AND t.target_lang = ${target})
    ORDER BY a.created_at DESC
  `) as Array<{ id: string; body: string }>;
  for (const a of analyses) out.push({ type: "analysis", id: String(a.id), text: String(a.body) });

  const titles = (await sql`
    SELECT dt.dream_id AS id, dt.title AS body
    FROM dream_titles dt JOIN dreams d ON d.id = dt.dream_id
    WHERE d.user_id = ${userId}
      AND NOT EXISTS (
        SELECT 1 FROM translations t
        WHERE t.source_type = 'title' AND t.source_id = dt.dream_id
          AND t.target_lang = ${target})
    ORDER BY d.sequence_no DESC
  `) as Array<{ id: string; body: string }>;
  for (const t of titles) out.push({ type: "title", id: String(t.id), text: String(t.body) });

  // The latest accepted proposal is the restatement's text.
  const restatements = (await sql`
    SELECT r.id, (
      SELECT tn.body FROM restatement_turns tn
      WHERE tn.restatement_id = r.id AND tn.role = 'proposal'
      ORDER BY tn.turn_no DESC LIMIT 1
    ) AS body
    FROM restatements r JOIN dreams d ON d.id = r.dream_id
    WHERE d.user_id = ${userId} AND r.accepted = true
      AND NOT EXISTS (
        SELECT 1 FROM translations t
        WHERE t.source_type = 'restatement' AND t.source_id = r.id
          AND t.target_lang = ${target})
    ORDER BY d.sequence_no DESC
  `) as Array<{ id: string; body: string | null }>;
  for (const r of restatements) {
    if (r.body && String(r.body).trim()) {
      out.push({ type: "restatement", id: String(r.id), text: String(r.body) });
    }
  }

  const dreams = (await sql`
    SELECT d.id, d.raw_transcript AS body
    FROM dreams d
    WHERE d.user_id = ${userId}
      AND NOT EXISTS (
        SELECT 1 FROM translations t
        WHERE t.source_type = 'dream' AND t.source_id = d.id
          AND t.target_lang = ${target})
    ORDER BY d.sequence_no DESC
  `) as Array<{ id: string; body: string }>;
  for (const d of dreams) out.push({ type: "dream", id: String(d.id), text: String(d.body) });

  const addenda = (await sql`
    SELECT a.id, a.body
    FROM dream_addenda a JOIN dreams d ON d.id = a.dream_id
    WHERE d.user_id = ${userId}
      AND NOT EXISTS (
        SELECT 1 FROM translations t
        WHERE t.source_type = 'addendum' AND t.source_id = a.id
          AND t.target_lang = ${target})
    ORDER BY d.sequence_no DESC, a.addendum_no ASC
  `) as Array<{ id: string; body: string }>;
  for (const a of addenda) out.push({ type: "addendum", id: String(a.id), text: String(a.body) });

  return out;
}

export type Quote = { items: number; tokens: { input: number; output: number }; usd: number };

/**
 * What the backfill will cost, computed without calling anything. Quoting a
 * price should never itself cost money, and a one-time lump on someone's own
 * key should never be a surprise.
 */
export async function quote(userId: string, target: Lang): Promise<Quote> {
  const items = await pendingItems(userId, target);
  const tokens = estimateTokens(items.map((i) => i.text));
  return { items: items.length, tokens, usd: estimateUsd(tokens) };
}

