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
  /** Who redeemed it. Your own invitation, so this is yours to see. */
  usedByEmail: string | null;
};

// Invitations this user issued, newest first. Degrades to empty if the table
// isn't there yet rather than taking Settings down.
export async function listInvites(userId: string): Promise<InviteListItem[]> {
  const sql = getSql();
  try {
    const rows = (await sql`
      SELECT i.id, i.code, i.used_at, i.revoked_at, i.created_at, u.email AS used_by_email
      FROM invites i
      LEFT JOIN users u ON u.id = i.used_by
      WHERE i.created_by = ${userId}
      ORDER BY i.created_at DESC
    `) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: String(r.id),
      code: String(r.code),
      status: inviteStatus(r as { used_at: unknown; revoked_at: unknown }),
      createdAt: toIso(r.created_at) ?? "",
      usedAt: toIso(r.used_at),
      usedByEmail: r.used_by_email == null ? null : String(r.used_by_email),
    }));
  } catch (err) {
    if (!isMissingSchema(err)) throw err;
    return [];
  }
}

export type StandingRow = {
  email: string;
  invited: number;
  isSelf: boolean;
};

/**
 * Who has brought the most people in, most first.
 *
 * Read from users.invited_by rather than from invites, so tidying the
 * invitations list never changes the standings (0022). Only accounts that have
 * actually invited someone appear — this is a tally, not a roster, and it is
 * the one place account names are shown to people who are not the owner, so it
 * shows no more than the tally needs.
 */
export async function inviteStandings(viewerId: string): Promise<StandingRow[]> {
  const sql = getSql();
  try {
    const rows = (await sql`
      SELECT inviter.id, inviter.email, count(u.id)::int AS invited,
             max(u.created_at) AS latest
      FROM users inviter
      JOIN users u ON u.invited_by = inviter.id
      GROUP BY inviter.id, inviter.email
      ORDER BY invited DESC, latest DESC
    `) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      email: String(r.email),
      invited: toInt(r.invited),
      isSelf: String(r.id) === viewerId,
    }));
  } catch (err) {
    if (!isMissingSchema(err)) throw err;
    return [];
  }
}

export type AccountRow = {
  id: string;
  email: string;
  role: "owner" | "member";
  createdAt: string;
  dreams: number;
  isSelf: boolean;
  /** Who brought them in. Null for the owner and for anyone who predates 0022. */
  invitedByEmail: string | null;
  /** True when this account's calls are billed to the viewer's key. */
  onMyKey: boolean;
  /** Tokens this account has put on the viewer's key, all time. */
  billedToMe: { input: number; output: number };
};

/**
 * Every account, for the owner's list. Carries the dream count because the
 * only useful thing to know before erasing an account is how much is in it.
 * Degrades to an empty list if the role column isn't there yet.
 */
export async function listAccounts(viewerId: string): Promise<AccountRow[]> {
  const sql = getSql();
  try {
    const rows = (await sql`
      SELECT u.id, u.email, u.role, u.created_at, u.key_sponsor_id,
             inviter.email AS invited_by_email,
             (SELECT count(*)::int FROM dreams d WHERE d.user_id = u.id) AS dreams,
             (SELECT coalesce(sum(e.input_tokens), 0) FROM usage_events e
               WHERE e.user_id = u.id AND e.billed_to = ${viewerId}) AS billed_in,
             (SELECT coalesce(sum(e.output_tokens), 0) FROM usage_events e
               WHERE e.user_id = u.id AND e.billed_to = ${viewerId}) AS billed_out
      FROM users u
      LEFT JOIN users inviter ON inviter.id = u.invited_by
      ORDER BY u.created_at ASC
    `) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: String(r.id),
      email: String(r.email),
      role: r.role === "owner" ? "owner" : "member",
      createdAt: toIso(r.created_at) ?? "",
      dreams: toInt(r.dreams),
      isSelf: String(r.id) === viewerId,
      invitedByEmail: r.invited_by_email == null ? null : String(r.invited_by_email),
      onMyKey: r.key_sponsor_id != null && String(r.key_sponsor_id) === viewerId,
      billedToMe: { input: toInt(r.billed_in), output: toInt(r.billed_out) },
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
      SELECT id, addendum_no, body, captured_at FROM dream_addenda
      WHERE dream_id = ${dreamId} ORDER BY addendum_no ASC
    `) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: String(r.id),
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
      SELECT a.id, a.dream_id, a.addendum_no, a.body, a.captured_at
      FROM dream_addenda a JOIN dreams d ON d.id = a.dream_id
      WHERE d.user_id = ${userId}
      ORDER BY a.addendum_no ASC
    `) as Array<Record<string, unknown>>;
    for (const r of rows) {
      const key = String(r.dream_id);
      const list = out.get(key) ?? [];
      list.push({
        id: String(r.id),
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

/** One piece of evidence: a claim, a dream, and the passage it rests on. */
export type ClaimSpan = {
  id: string;
  dreamId: string;
  /** The dream's position in the corpus, for the mono header on the modal. */
  dreamNumber: number;
  dreamtOn: string | null;
  quote: string;
  /** Offsets into that dream's raw transcript. Null when unresolved. */
  start: number | null;
  end: number | null;
  kind: "exact" | "normalized" | "unresolved";
};

export type TrendClaim = {
  id: string;
  claim: string;
  citations: Citation[];
  spans: ClaimSpan[];
};

/** How the evidence for a run landed. The unresolved count is the one to watch. */
export type SpanTally = { exact: number; normalized: number; unresolved: number };
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
  spanTally: SpanTally;
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
    SELECT id, sequence_no, dreamt_on FROM dreams WHERE user_id = ${userId}
  `) as Array<Record<string, unknown>>;
  const seqById = new Map<string, number>();
  const dateById = new Map<string, string | null>();
  for (const d of dreamRows) {
    seqById.set(String(d.id), toInt(d.sequence_no));
    dateById.set(String(d.id), toDateStr(d.dreamt_on));
  }

  // Evidence for every claim on the page, in one query. Degrades to no spans
  // if 0024 hasn't landed — the runs still read, they just aren't clickable.
  const spansByClaim = new Map<string, ClaimSpan[]>();
  try {
    const spanRows = (await sql`
      SELECT s.id, s.trend_claim_id, s.dream_id, s.quote,
             s.char_start, s.char_end, s.match_kind
      FROM trend_claim_spans s
      JOIN trend_claims c ON c.id = s.trend_claim_id
      JOIN trend_runs r   ON r.id = c.trend_run_id
      WHERE r.user_id = ${userId}
      ORDER BY s.created_at ASC
    `) as Array<Record<string, unknown>>;
    for (const s of spanRows) {
      const dreamId = String(s.dream_id);
      const claimId = String(s.trend_claim_id);
      const list = spansByClaim.get(claimId) ?? [];
      list.push({
        id: String(s.id),
        dreamId,
        dreamNumber: seqById.get(dreamId) ?? 0,
        dreamtOn: dateById.get(dreamId) ?? null,
        quote: String(s.quote),
        start: s.char_start == null ? null : toInt(s.char_start),
        end: s.char_end == null ? null : toInt(s.char_end),
        kind:
          s.match_kind === "exact"
            ? "exact"
            : s.match_kind === "normalized"
              ? "normalized"
              : "unresolved",
      });
      spansByClaim.set(claimId, list);
    }
  } catch (err) {
    if (!isMissingSchema(err)) throw err;
  }

  const runs: TrendRun[] = [];
  for (const r of runRows) {
    const runId = String(r.id);
    const claimRows = (await sql`
      SELECT id, claim, dream_ids FROM trend_claims
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
      const spans = (spansByClaim.get(String(c.id)) ?? []).sort(
        (a, b) => a.dreamNumber - b.dreamNumber || (a.start ?? 0) - (b.start ?? 0)
      );
      return { id: String(c.id), claim: String(c.claim), citations, spans };
    });
    const spanTally: SpanTally = { exact: 0, normalized: 0, unresolved: 0 };
    for (const c of claims) for (const s of c.spans) spanTally[s.kind]++;
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
      spanTally,
    });
  }
  return runs;
}

/** A passage of one dream that trend claims keep coming back to. */
export type DreamCitation = {
  start: number;
  end: number;
  quote: string;
  claims: Array<{ id: string; claim: string; runId: string; runCreatedAt: string }>;
};

/**
 * The reverse direction: which of this dream's words the machine keeps
 * returning to, and what it built on them.
 *
 * Grouped by character range, because two claims resting on the same sentence
 * is the interesting case — that is a passage doing work — and showing it as
 * two identical marks in the margin would hide exactly that.
 */
export async function citationsForDream(
  dreamId: string,
  userId: string
): Promise<DreamCitation[]> {
  const sql = getSql();
  try {
    const rows = (await sql`
      SELECT s.char_start, s.char_end, s.quote,
             c.id AS claim_id, c.claim, r.id AS run_id, r.created_at
      FROM trend_claim_spans s
      JOIN trend_claims c ON c.id = s.trend_claim_id
      JOIN trend_runs r   ON r.id = c.trend_run_id
      WHERE s.dream_id = ${dreamId} AND r.user_id = ${userId}
        AND s.char_start IS NOT NULL
      ORDER BY s.char_start ASC, r.created_at DESC
    `) as Array<Record<string, unknown>>;

    const byRange = new Map<string, DreamCitation>();
    for (const r of rows) {
      const start = toInt(r.char_start);
      const end = toInt(r.char_end);
      const key = `${start}:${end}`;
      const entry = byRange.get(key) ?? { start, end, quote: String(r.quote), claims: [] };
      // The same claim can be reached twice if it cites one passage more than
      // once; the margin should list it once.
      if (!entry.claims.some((c) => c.id === String(r.claim_id))) {
        entry.claims.push({
          id: String(r.claim_id),
          claim: String(r.claim),
          runId: String(r.run_id),
          runCreatedAt: toIso(r.created_at) ?? "",
        });
      }
      byRange.set(key, entry);
    }
    return Array.from(byRange.values()).sort((a, b) => a.start - b.start);
  } catch (err) {
    if (!isMissingSchema(err)) throw err;
    return [];
  }
}

// Cost visibility: lifetime token total from the append-only usage ledger
// (0009). Reading the ledger — not the per-row token columns — means the total
// reflects money actually spent and never drops when a dream is deleted.
/**
 * What other people have put on this account's key.
 *
 * getTokenTotal only counts an account's own generating, because usage_events
 * is keyed by who made the text. Sponsored spend lands under the sponsored
 * account, so without this the person actually being billed cannot see it —
 * which is the one number they most need.
 */
export async function getSponsoredTokenTotal(
  userId: string
): Promise<{ input: number; output: number }> {
  const sql = getSql();
  try {
    const [row] = (await sql`
      SELECT
        coalesce(sum(input_tokens), 0)  AS input,
        coalesce(sum(output_tokens), 0) AS output
      FROM usage_events
      WHERE billed_to = ${userId} AND user_id <> ${userId}
    `) as Array<{ input: unknown; output: unknown }>;
    return { input: toInt(row.input), output: toInt(row.output) };
  } catch (err) {
    if (!isMissingSchema(err)) throw err;
    return { input: 0, output: 0 };
  }
}

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
