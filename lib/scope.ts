// Trend-run scoping. A trend pass can cover the whole corpus, the last N
// dreams, or a date range. The scope is validated here and stored on the run
// (trend_runs is immutable), so an old run stays interpretable later — "these
// claims came from the last 5 dreams" is a different statement from "these
// claims came from everything".

export type Scope =
  | { kind: "all" }
  | { kind: "last_n"; lastN: number }
  | { kind: "range"; from: string | null; to: string | null };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Same shape, but with capture groups — DATE_RE is validation-only and has none.
const DATE_PARTS_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Format YYYY-MM-DD without going through Date() (which would shift the day
// across timezones).
export function formatDate(iso: string): string {
  const m = iso.match(DATE_PARTS_RE);
  if (!m) return iso;
  const [, y, mo, d] = m;
  return `${MONTHS[Number(mo) - 1] ?? mo} ${Number(d)}, ${y}`;
}

// Parse whatever the client sent into a valid Scope, or return an error string.
// Never trusts the client: an unknown kind, a bad date, or a non-positive N all
// fail rather than silently widening the scope.
export function parseScope(raw: unknown): { scope: Scope } | { error: string } {
  const s = (raw ?? {}) as Record<string, unknown>;
  const kind = s.kind ?? "all";

  if (kind === "all") return { scope: { kind: "all" } };

  if (kind === "last_n") {
    const n = Math.floor(Number(s.lastN));
    if (!Number.isFinite(n) || n < 1) return { error: "Pick at least 1 dream." };
    return { scope: { kind: "last_n", lastN: Math.min(n, 10000) } };
  }

  if (kind === "range") {
    const from = typeof s.from === "string" && DATE_RE.test(s.from) ? s.from : null;
    const to = typeof s.to === "string" && DATE_RE.test(s.to) ? s.to : null;
    if (!from && !to) return { error: "Pick a start or end date." };
    if (from && to && from > to) return { error: "The start date is after the end date." };
    return { scope: { kind: "range", from, to } };
  }

  return { error: "Unknown scope." };
}

// Human-readable label, stored on the run and shown in the UI.
export function scopeLabel(scope: Scope): string {
  switch (scope.kind) {
    case "all":
      return "All dreams";
    case "last_n":
      return `Last ${scope.lastN} dream${scope.lastN === 1 ? "" : "s"}`;
    case "range": {
      if (scope.from && scope.to) return `${formatDate(scope.from)} – ${formatDate(scope.to)}`;
      if (scope.from) return `Since ${formatDate(scope.from)}`;
      return `Up to ${formatDate(scope.to as string)}`;
    }
  }
}

// Which dreams fall in scope. Shared by the server (to build the corpus) and
// the client (to preview the count before spending anything), so the number the
// user sees is the number the run actually uses.
export function selectInScope<T extends { sequenceNo: number; dreamtOn: string | null }>(
  dreams: T[],
  scope: Scope
): T[] {
  // Newest first by sequence_no — the canonical order (dates can be approximate).
  const ordered = [...dreams].sort((a, b) => b.sequenceNo - a.sequenceNo);

  if (scope.kind === "all") return ordered;
  if (scope.kind === "last_n") return ordered.slice(0, scope.lastN);

  return ordered.filter((d) => {
    if (!d.dreamtOn) return false; // undated dreams can't be in a date range
    if (scope.from && d.dreamtOn < scope.from) return false;
    if (scope.to && d.dreamtOn > scope.to) return false;
    return true;
  });
}

// Today and common relative starting points, as YYYY-MM-DD in local time.
export function isoToday(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function isoDaysAgo(days: number, now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - days);
  return isoToday(d);
}
