import { getSql } from "@/lib/db";

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
function firstLine(text: string): string {
  return (String(text).split("\n").find((l) => l.trim().length > 0) ?? "").trim();
}

export type DreamListItem = {
  id: string;
  sequenceNo: number;
  dreamtOn: string | null;
  firstLine: string;
};

export async function listDreams(userId: string): Promise<DreamListItem[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, sequence_no, dreamt_on, raw_transcript
    FROM dreams WHERE user_id = ${userId}
    ORDER BY sequence_no DESC
  `) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: String(r.id),
    sequenceNo: toInt(r.sequence_no),
    dreamtOn: toDateStr(r.dreamt_on),
    firstLine: firstLine(r.raw_transcript as string),
  }));
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
};

export async function getDream(id: string, userId: string): Promise<Dream | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, sequence_no, dreamt_on, capture_method, raw_transcript
    FROM dreams WHERE id = ${id} AND user_id = ${userId}
  `) as Array<Record<string, unknown>>;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: String(r.id),
    sequenceNo: toInt(r.sequence_no),
    dreamtOn: toDateStr(r.dreamt_on),
    captureMethod: r.capture_method == null ? null : String(r.capture_method),
    rawTranscript: String(r.raw_transcript),
  };
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
  model: string;
  promptVersion: string;
  body: string | null;
  createdAt: string;
  claims: TrendClaim[];
};

export async function listTrendRuns(userId: string): Promise<TrendRun[]> {
  const sql = getSql();
  const runRows = (await sql`
    SELECT id, corpus_size, model, prompt_version, body, created_at
    FROM trend_runs WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `) as Array<Record<string, unknown>>;
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
      model: String(r.model),
      promptVersion: String(r.prompt_version),
      body: r.body == null ? null : String(r.body),
      createdAt: toIso(r.created_at) ?? "",
      claims,
    });
  }
  return runs;
}

// Cost visibility: running token total across all of the user's generated rows.
export async function getTokenTotal(userId: string): Promise<{ input: number; output: number }> {
  const sql = getSql();
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
