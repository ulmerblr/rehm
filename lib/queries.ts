import { getSql } from "@/lib/db";
import { SUBJECT_ID } from "@/lib/config";

// Neon driver quirks (see README / standing notes): DATE comes back as a Date
// object, integers as numbers, uuid[] as a JS array, nulls as null. These
// helpers coerce and guard every value read.

function toDateStr(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function toInt(value: unknown): number {
  return Number(value);
}

function firstLine(text: string): string {
  const line = String(text).split("\n").find((l) => l.trim().length > 0) ?? "";
  return line.trim();
}

export type DreamListItem = {
  id: string;
  sequenceNo: number;
  dreamtOn: string | null;
  firstLine: string;
};

export async function listDreams(): Promise<DreamListItem[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, sequence_no, dreamt_on, raw_transcript
    FROM dreams
    WHERE user_id = ${SUBJECT_ID}
    ORDER BY sequence_no DESC
  `) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: String(r.id),
    sequenceNo: toInt(r.sequence_no),
    dreamtOn: toDateStr(r.dreamt_on),
    firstLine: firstLine(r.raw_transcript as string),
  }));
}

export async function nextSequenceNo(): Promise<number> {
  const sql = getSql();
  const [row] = (await sql`
    SELECT coalesce(max(sequence_no), 0) + 1 AS next
    FROM dreams WHERE user_id = ${SUBJECT_ID}
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

export async function getDream(id: string): Promise<Dream | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id, sequence_no, dreamt_on, capture_method, raw_transcript
    FROM dreams WHERE id = ${id} AND user_id = ${SUBJECT_ID}
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
export type AcceptedRestatement = {
  id: string;
  model: string;
  promptVersion: string;
  acceptedAt: string | null;
  text: string; // the last proposal turn (the agreed text)
  turns: Turn[];
};

export async function getAcceptedRestatement(
  dreamId: string
): Promise<AcceptedRestatement | null> {
  const sql = getSql();
  const restRows = (await sql`
    SELECT id, model, prompt_version, accepted, accepted_at
    FROM restatements
    WHERE dream_id = ${dreamId} AND accepted = true
    ORDER BY accepted_at DESC NULLS LAST
    LIMIT 1
  `) as Array<Record<string, unknown>>;
  if (restRows.length === 0) return null;
  const r = restRows[0];
  const restatementId = String(r.id);

  const turnRows = (await sql`
    SELECT turn_no, role, body FROM restatement_turns
    WHERE restatement_id = ${restatementId}
    ORDER BY turn_no ASC
  `) as Array<Record<string, unknown>>;
  const turns: Turn[] = turnRows.map((t) => ({
    turnNo: toInt(t.turn_no),
    role: t.role as "proposal" | "objection",
    body: String(t.body),
  }));
  const proposals = turns.filter((t) => t.role === "proposal");
  const text = proposals.length > 0 ? proposals[proposals.length - 1].body : "";

  return {
    id: restatementId,
    model: String(r.model),
    promptVersion: String(r.prompt_version),
    acceptedAt: r.accepted_at == null ? null : new Date(r.accepted_at as string).toISOString(),
    text,
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
    createdAt: new Date(r.created_at as string).toISOString(),
  }));
}

export type Citation = { number: number; id: string };
export type TrendClaim = {
  claim: string;
  citations: Citation[];
};
export type TrendRun = {
  id: string;
  corpusSize: number;
  model: string;
  promptVersion: string;
  body: string | null;
  createdAt: string;
  claims: TrendClaim[];
};

export async function listTrendRuns(): Promise<TrendRun[]> {
  const sql = getSql();
  const runRows = (await sql`
    SELECT id, corpus_size, model, prompt_version, body, created_at
    FROM trend_runs WHERE user_id = ${SUBJECT_ID}
    ORDER BY created_at DESC
  `) as Array<Record<string, unknown>>;
  if (runRows.length === 0) return [];

  // Map dream id -> sequence_no for rendering citations as dream numbers.
  const dreamRows = (await sql`
    SELECT id, sequence_no FROM dreams WHERE user_id = ${SUBJECT_ID}
  `) as Array<Record<string, unknown>>;
  const seqById = new Map<string, number>();
  for (const d of dreamRows) seqById.set(String(d.id), toInt(d.sequence_no));

  const runs: TrendRun[] = [];
  for (const r of runRows) {
    const runId = String(r.id);
    const claimRows = (await sql`
      SELECT claim, dream_ids FROM trend_claims
      WHERE trend_run_id = ${runId}
      ORDER BY created_at ASC
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
      createdAt: new Date(r.created_at as string).toISOString(),
      claims,
    });
  }
  return runs;
}
