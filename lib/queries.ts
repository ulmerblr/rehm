import { getSql } from "@/lib/db";
import type { Addendum } from "@/lib/dreamText";
import { inviteStatus } from "@/lib/invites";

// Neon driver quirks: DATE -> Date object, integers -> number, bigint (sum,
// count) -> string, uuid[] -> JS array, nulls -> null. Coerce and guard every
// value read. Every query below is scoped by the session user id passed in;
// user_id is never taken from the client.

function toDateStr(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}
function toInt(value: unknown): number {
  return Number(value);
}
function toIso(value: unknown): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}
// A schema gap must degrade, never white-screen the app. Postgres reports a
// missing table/column as "... does not exist"; callers below fall back to a
// query that doesn't need it.
function isMissingSchema(err: unknown): boolean {
  const m = err instanceof Error ? err.message : String(err);
  return /does not exist/i.test(m);
}

// A short, one-line title for the dream list, derived from the raw transcript
// (no LLM, no cost). A dictation is often one long paragraph, so keying on the
// first newline would show the whole thing — instead take the first sentence if
// it's short, otherwise a hard character cap at a word boundary, with an
// ellipsis when truncated. This is display-only; the immutable transcript is
// untouched.
function deriveTitle(text: string): string {
  const clean = String(text).replace(/\s+/g, " ").trim();
  if (!clean) return "(no text)";

  const CAP = 72;
  const sentence = clean.match(/^.*?[.!?](?:\s|$)/)?.[0].trim();
  let title = sentence && sentence.length <= CAP ? sentence : clean;

  if (title.length > CAP) {
    const cut = title.slice(0, CAP);
    const lastSpace = cut.lastIndexOf(" ");
    title = (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim() + "…";
  }
  // Drop trailing sentence punctuation for a cleaner title (keep the ellipsis).
  return title.endsWith("…") ? title : title.replace(/[.!?]+$/, "");
}

// The opening words of the transcript, for the list's secondary line. Kept
// generously long — the row clamps it to exactly one line in CSS, so it adapts
// to the screen width instead of guessing a character count.
function deriveSnippet(text: string): string {
  return String(text).replace(/\s+/g, " ").trim().slice(0, 200);
}

export type DreamListItem = {
  id: string;
  sequenceNo: number;
  dreamtOn: string | null;
  title: string;
  snippet: string;
  analysisCount: number;
};

export async function listDreams(userId: string): Promise<DreamListItem[]> {
  const sql = getSql();
  let rows: Array<Record<string, unknown>>;
  try {
    rows = (await sql`
      SELECT d.id, d.sequence_no, d.dreamt_on, d.raw_transcript, t.title,
             count(a.id) AS analysis_count
      FROM dreams d
      LEFT JOIN dream_titles t ON t.dream_id = d.id
      LEFT JOIN analyses a ON a.dream_id = d.id
      WHERE d.user_id = ${userId}
      GROUP BY d.id, d.sequence_no, d.dreamt_on, d.raw_transcript, t.title
      ORDER BY d.sequence_no DESC
    `) as Array<Record<string, unknown>>;
  } catch (err) {
    if (!isMissingSchema(err)) throw err;
    // dream_titles not created yet — show derived titles rather than nothing.
    rows = (await sql`
      SELECT d.id, d.sequence_no, d.dreamt_on, d.raw_transcript, NULL AS title,
             count(a.id) AS analysis_count
      FROM dreams d
      LEFT JOIN analyses a ON a.dream_id = d.id
      WHERE d.user_id = ${userId}
      GROUP BY d.id, d.sequence_no, d.dreamt_on, d.raw_transcript
      ORDER BY d.sequence_no DESC
    `) as Array<Record<string, unknown>>;
  }
  return rows.map((r) => {
    const stored = r.title == null ? "" : String(r.title).trim();
    return {
      id: String(r.id),
      sequenceNo: toInt(r.sequence_no),
      dreamtOn: toDateStr(r.dreamt_on),
      // Prefer the saved (generated or edited) title; fall back to one derived
      // from the transcript for dreams that have no title row yet.
      title: stored || deriveTitle(r.raw_transcript as string),
      snippet: deriveSnippet(r.raw_transcript as string),
      analysisCount: toInt(r.analysis_count),
    };
  });
}

// Minimal (sequence_no, date) list for the trend scope picker: enough for the
// client to preview how many dreams a scope covers without another round trip.
export async function listDreamDates(
  userId: string
): Promise<Array<{ sequenceNo: number; dreamtOn: string | null }>> {
  const sql = getSql();
  const rows = (await sql`
    SELECT sequence_no, dreamt_on FROM dreams WHERE user_id = ${userId}
    ORDER BY sequence_no DESC
  `) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    sequenceNo: toInt(r.sequence_no),
    dreamtOn: toDateStr(r.dreamt_on),
  }));
}

export type InviteListItem = {
  id: string;
  code: string;
  status: "open" | "used" | "revoked";
  createdAt: string;
  usedAt: string | null;
};

// Invitations this user issued, newest first. Degrades to empty if the table
// isn't there yet rather than taking Settings down.
export async function listInvites(userId: string): Promise<InviteListItem[]> {
  const sql = getSql();
  try {
    const rows = (await sql`
      SELECT id, code, used_at, revoked_at, created_at
      FROM invites WHERE created_by = ${userId}
      ORDER BY created_at DESC
    `) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: String(r.id),
      code: String(r.code),
      status: inviteStatus(r as { used_at: unknown; revoked_at: unknown }),
      createdAt: toIso(r.created_at) ?? "",
      usedAt: toIso(r.used_at),
    }));
  } catch (err) {
    if (!isMissingSchema(err)) throw err;
    return [];
  }
}

export type DashboardStats = {
  dreams: number;
  analyzedDreams: number;
  analyses: number;
  trendRuns: number;
  additions: number;
  lastDream: DreamListItem | null;
  lastTrendAt: string | null;
  lastTrendCorpus: number | null;
  lastDreamExcerpt: string;
};

// Summary counts for the home page. Tables added by later migrations degrade to
// zero rather than taking the page down.
export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const sql = getSql();
  const dreams = await listDreams(userId);

  const [a] = (await sql`
    SELECT count(*) AS n FROM analyses a
    JOIN dreams d ON d.id = a.dream_id WHERE d.user_id = ${userId}
  `) as Array<{ n: unknown }>;

  const [t] = (await sql`
    SELECT count(*) AS n, max(created_at) AS last_at
    FROM trend_runs WHERE user_id = ${userId}
  `) as Array<{ n: unknown; last_at: unknown }>;

  // The corpus size of the most recent pass — a claim means something
  // different at corpus 9 than at corpus 90, so the size is the version.
  const lastRun = (await sql`
    SELECT corpus_size FROM trend_runs WHERE user_id = ${userId}
    ORDER BY created_at DESC LIMIT 1
  `) as Array<{ corpus_size: unknown }>;

  let additions = 0;
  try {
    const [r] = (await sql`
      SELECT count(*) AS n FROM dream_addenda x
      JOIN dreams d ON d.id = x.dream_id WHERE d.user_id = ${userId}
    `) as Array<{ n: unknown }>;
    additions = toInt(r.n);
  } catch (err) {
    if (!isMissingSchema(err)) throw err;
  }

  return {
    dreams: dreams.length,
    analyzedDreams: dreams.filter((d) => d.analysisCount > 0).length,
    analyses: toInt(a.n),
    trendRuns: toInt(t.n),
    additions,
    lastDream: dreams[0] ?? null,
    lastTrendAt: toIso(t.last_at),
    lastTrendCorpus: lastRun.length > 0 ? toInt(lastRun[0].corpus_size) : null,
    lastDreamExcerpt: dreams[0]?.snippet ?? "",
  };
}

export async function nextSequenceNo(userId: string): Promise<number> {
  const sql = getSql();
  const [row] = (await sql`
    SELECT coalesce(max(sequence_no), 0) + 1 AS next
    FROM dreams WHERE user_id = ${userId}
  `) as Array<{ next: unknown }>;
  return toInt(row.next);
}

export type Dream = {
  id: string;
  sequenceNo: number;
  dreamtOn: string | null;
  captureMethod: string | null;
  rawTranscript: string;
  title: string;
  titleIsCustom: boolean;
};

export async function getDream(id: string, userId: string): Promise<Dream | null> {
  const sql = getSql();
  let rows: Array<Record<string, unknown>>;
  try {
    rows = (await sql`
      SELECT d.id, d.sequence_no, d.dreamt_on, d.capture_method, d.raw_transcript, t.title
      FROM dreams d
      LEFT JOIN dream_titles t ON t.dream_id = d.id
      WHERE d.id = ${id} AND d.user_id = ${userId}
    `) as Array<Record<string, unknown>>;
  } catch (err) {
    if (!isMissingSchema(err)) throw err;
    rows = (await sql`
      SELECT id, sequence_no, dreamt_on, capture_method, raw_transcript, NULL AS title
      FROM dreams WHERE id = ${id} AND user_id = ${userId}
    `) as Array<Record<string, unknown>>;
  }
  if (rows.length === 0) return null;
  const r = rows[0];
  const stored = r.title == null ? "" : String(r.title).trim();
  return {
    id: String(r.id),
    sequenceNo: toInt(r.sequence_no),
    dreamtOn: toDateStr(r.dreamt_on),
    captureMethod: r.capture_method == null ? null : String(r.capture_method),
    rawTranscript: String(r.raw_transcript),
    // Always non-empty: the saved title, or one derived from the transcript.
    title: stored || deriveTitle(String(r.raw_transcript)),
    titleIsCustom: stored.length > 0,
  };
}

// Additions the dreamer made after capture ("I remembered something else").
// Ordered oldest first. Degrades to an empty list if the table isn't there yet.
export async function getAddenda(dreamId: string): Promise<Addendum[]> {
  const sql = getSql();
  try {
    const rows = (await sql`
      SELECT addendum_no, body, captured_at FROM dream_addenda
      WHERE dream_id = ${dreamId} ORDER BY addendum_no ASC
    `) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      addendumNo: toInt(r.addendum_no),
      body: String(r.body),
      capturedAt: toIso(r.captured_at) ?? "",
    }));
  } catch (err) {
    if (!isMissingSchema(err)) throw err;
    return [];
  }
}

// Every addendum for the user's whole corpus, grouped by dream id — one query
// for a trend pass instead of one per dream.
export async function addendaByDream(userId: string): Promise<Map<string, Addendum[]>> {
  const sql = getSql();
  const out = new Map<string, Addendum[]>();
  try {
    const rows = (await sql`
      SELECT a.dream_id, a.addendum_no, a.body, a.captured_at
      FROM dream_addenda a JOIN dreams d ON d.id = a.dream_id
      WHERE d.user_id = ${userId}
      ORDER BY a.addendum_no ASC
    `) as Array<Record<string, unknown>>;
    for (const r of rows) {
      const key = String(r.dream_id);
      const list = out.get(key) ?? [];
      list.push({
        addendumNo: toInt(r.addendum_no),
        body: String(r.body),
        capturedAt: toIso(r.captured_at) ?? "",
      });
      out.set(key, list);
    }
  } catch (err) {
    if (!isMissingSchema(err)) throw err;
  }
  return out;
}

// The most recent analysis per dream, for a trend pass that reads
// interpretations alongside the transcripts.
export async function latestAnalysisByDream(userId: string): Promise<Map<string, string>> {
  const sql = getSql();
  const rows = (await sql`
    SELECT DISTINCT ON (a.dream_id) a.dream_id, a.body
    FROM analyses a JOIN dreams d ON d.id = a.dream_id
    WHERE d.user_id = ${userId} AND a.body IS NOT NULL
    ORDER BY a.dream_id, a.created_at DESC
  `) as Array<Record<string, unknown>>;
  const out = new Map<string, string>();
  for (const r of rows) out.set(String(r.dream_id), String(r.body));
  return out;
}

export type Turn = { turnNo: number; role: "proposal" | "objection"; body: string };
export type RestatementState = {
  id: string;
  accepted: boolean;
  acceptedAt: string | null;
  model: string;
  promptVersion: string;
  latestProposal: string | null;
  turns: Turn[];
};

// The single restatement for a dream (accepted or still open). Call only after
// the dream's ownership has been verified.
export async function getRestatementState(dreamId: string): Promise<RestatementState | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, accepted, accepted_at, model, prompt_version
    FROM restatements WHERE dream_id = ${dreamId}
    ORDER BY created_at ASC LIMIT 1
  `) as Array<Record<string, unknown>>;
  if (rows.length === 0) return null;
  const r = rows[0];
  const id = String(r.id);

  const turnRows = (await sql`
    SELECT turn_no, role, body FROM restatement_turns
    WHERE restatement_id = ${id} ORDER BY turn_no ASC
  `) as Array<Record<string, unknown>>;
  const turns: Turn[] = turnRows.map((t) => ({
    turnNo: toInt(t.turn_no),
    role: t.role as "proposal" | "objection",
    body: String(t.body),
  }));
  const proposals = turns.filter((t) => t.role === "proposal");

  return {
    id,
    accepted: Boolean(r.accepted),
    acceptedAt: toIso(r.accepted_at),
    model: String(r.model),
    promptVersion: String(r.prompt_version),
    latestProposal: proposals.length > 0 ? proposals[proposals.length - 1].body : null,
    turns,
  };
}

export type Analysis = {
  id: string;
  body: string;
  model: string;
  promptVersion: string;
  blind: boolean;
  createdAt: string;
};

export async function getAnalyses(dreamId: string): Promise<Analysis[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, body, model, prompt_version, blind, created_at
    FROM analyses WHERE dream_id = ${dreamId}
    ORDER BY created_at DESC
  `) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: String(r.id),
    body: String(r.body),
    model: String(r.model),
    promptVersion: String(r.prompt_version),
    blind: Boolean(r.blind),
    createdAt: toIso(r.created_at) ?? "",
  }));
}

export type Citation = { number: number; id: string };
export type TrendClaim = { claim: string; citations: Citation[] };
export type TrendRun = {
  id: string;
  corpusSize: number;
  scopeLabel: string;
  dreamNumbers: number[];
  source: "dreams" | "dreams_and_analyses";
  model: string;
  promptVersion: string;
  body: string | null;
  closing: string | null;
  createdAt: string;
  claims: TrendClaim[];
};

export async function listTrendRuns(userId: string): Promise<TrendRun[]> {
  const sql = getSql();
  let runRows: Array<Record<string, unknown>>;
  try {
    runRows = (await sql`
      SELECT id, corpus_size, scope_label, dream_numbers, source, model,
             prompt_version, body, closing, created_at
      FROM trend_runs WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `) as Array<Record<string, unknown>>;
  } catch (err) {
    if (!isMissingSchema(err)) throw err;
    // Newer columns not added yet — fall back to what every schema has had.
    runRows = (await sql`
      SELECT id, corpus_size, NULL AS scope_label, NULL AS dream_numbers,
             NULL AS source, model, prompt_version, body, NULL AS closing, created_at
      FROM trend_runs WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `) as Array<Record<string, unknown>>;
  }
  if (runRows.length === 0) return [];

  const dreamRows = (await sql`
    SELECT id, sequence_no FROM dreams WHERE user_id = ${userId}
  `) as Array<Record<string, unknown>>;
  const seqById = new Map<string, number>();
  for (const d of dreamRows) seqById.set(String(d.id), toInt(d.sequence_no));

  const runs: TrendRun[] = [];
  for (const r of runRows) {
    const runId = String(r.id);
    const claimRows = (await sql`
      SELECT claim, dream_ids FROM trend_claims
      WHERE trend_run_id = ${runId} ORDER BY created_at ASC
    `) as Array<Record<string, unknown>>;
    const claims: TrendClaim[] = claimRows.map((c) => {
      const dreamIds = Array.isArray(c.dream_ids)
        ? (c.dream_ids as unknown[]).map(String)
        : [];
      const citations: Citation[] = dreamIds
        .map((id) => ({ id, number: seqById.get(id) }))
        .filter((c): c is Citation => typeof c.number === "number")
        .sort((a, b) => a.number - b.number);
      return { claim: String(c.claim), citations };
    });
    runs.push({
      id: runId,
      corpusSize: toInt(r.corpus_size),
      scopeLabel: r.scope_label == null ? "All dreams" : String(r.scope_label),
      // Older runs predate recording membership — fall back to the dreams the
      // run's own claims cite, which is the best evidence available.
      dreamNumbers: Array.isArray(r.dream_numbers)
        ? (r.dream_numbers as unknown[]).map((n) => toInt(n))
        : Array.from(new Set(claims.flatMap((c) => c.citations.map((cit) => cit.number)))),
      // Runs predating the choice all read transcripts only.
      source: r.source === "dreams_and_analyses" ? "dreams_and_analyses" : "dreams",
      model: String(r.model),
      promptVersion: String(r.prompt_version),
      body: r.body == null ? null : String(r.body),
      closing: r.closing == null ? null : String(r.closing),
      createdAt: toIso(r.created_at) ?? "",
      claims,
    });
  }
  return runs;
}

// Cost visibility: lifetime token total from the append-only usage ledger
// (0009). Reading the ledger — not the per-row token columns — means the total
// reflects money actually spent and never drops when a dream is deleted.
export async function getTokenTotal(userId: string): Promise<{ input: number; output: number }> {
  const sql = getSql();
  try {
    const [row] = (await sql`
      SELECT
        coalesce(sum(input_tokens), 0)  AS input,
        coalesce(sum(output_tokens), 0) AS output
      FROM usage_events WHERE user_id = ${userId}
    `) as Array<{ input: unknown; output: unknown }>;
    return { input: toInt(row.input), output: toInt(row.output) };
  } catch (err) {
    if (!isMissingSchema(err)) throw err;
    // Ledger not created yet — fall back to summing the per-row token columns.
    const [row] = (await sql`
      SELECT
        coalesce(sum(input_tokens), 0)  AS input,
        coalesce(sum(output_tokens), 0) AS output
      FROM (
        SELECT r.input_tokens, r.output_tokens
          FROM restatements r JOIN dreams d ON d.id = r.dream_id
          WHERE d.user_id = ${userId}
        UNION ALL
        SELECT a.input_tokens, a.output_tokens
          FROM analyses a JOIN dreams d ON d.id = a.dream_id
          WHERE d.user_id = ${userId}
        UNION ALL
        SELECT input_tokens, output_tokens
          FROM trend_runs WHERE user_id = ${userId}
      ) t
    `) as Array<{ input: unknown; output: unknown }>;
    return { input: toInt(row.input), output: toInt(row.output) };
  }
}

export type KeyInfo = {
  label: string | null;
  lastFour: string;
  lastVerifiedAt: string | null;
  status: string;
};

export async function getActiveKeyInfo(userId: string): Promise<KeyInfo | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT label, last_four, last_verified_at, status
    FROM user_api_keys WHERE user_id = ${userId} AND status = 'active'
    LIMIT 1
  `) as Array<Record<string, unknown>>;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    label: r.label == null ? null : String(r.label),
    lastFour: String(r.last_four),
    lastVerifiedAt: toIso(r.last_verified_at),
    status: String(r.status),
  };
}

export async function getUserEmail(userId: string): Promise<string | null> {
  const sql = getSql();
  const rows = (await sql`SELECT email FROM users WHERE id = ${userId}`) as Array<{
    email: string;
  }>;
  return rows.length > 0 ? rows[0].email : null;
}
