// Cadence math for the home dashboard.
//
// In a longitudinal study the sample size is only half the story: a trend pass
// over nine dreams recorded across three days means something very different
// from nine spread over six months. So the home page reports span, recency, and
// the largest gap — the things that decide whether a claim is worth anything.
//
// All arithmetic is done on YYYY-MM-DD strings via Date.UTC, never local Date
// parsing, so a timezone can't shift a day and change a gap.

export type DatedDream = {
  id: string;
  sequenceNo: number;
  dreamtOn: string | null;
  analysisCount: number;
};

export type Tick = {
  id: string;
  sequenceNo: number;
  date: string;
  /** 0–100, position across the span from first to last. */
  pct: number;
  analyzed: boolean;
};

export type Corpus = {
  ticks: Tick[];
  firstDate: string | null;
  lastDate: string | null;
  spanDays: number | null;
  daysSinceLast: number | null;
  longestGap: number | null;
  dated: number;
  undated: number;
};

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function toUtcDays(iso: string): number | null {
  const m = iso.match(DATE_RE);
  if (!m) return null;
  const [, y, mo, d] = m;
  return Date.UTC(Number(y), Number(mo) - 1, Number(d)) / 86_400_000;
}

/** Today as YYYY-MM-DD in UTC — a fixed reference, not the server's locale. */
export function utcToday(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function buildCorpus(dreams: DatedDream[], today: string = utcToday()): Corpus {
  const dated = dreams
    .filter((d) => d.dreamtOn && DATE_RE.test(d.dreamtOn))
    .map((d) => ({ ...d, dreamtOn: d.dreamtOn as string, day: toUtcDays(d.dreamtOn as string) as number }))
    .sort((a, b) => a.day - b.day);

  const undated = dreams.length - dated.length;
  if (dated.length === 0) {
    return {
      ticks: [],
      firstDate: null,
      lastDate: null,
      spanDays: null,
      daysSinceLast: null,
      longestGap: null,
      dated: 0,
      undated,
    };
  }

  const first = dated[0];
  const last = dated[dated.length - 1];
  const span = last.day - first.day;

  // Longest stretch between consecutive recordings.
  let longestGap = 0;
  for (let i = 1; i < dated.length; i++) {
    longestGap = Math.max(longestGap, dated[i].day - dated[i - 1].day);
  }

  const todayDays = toUtcDays(today);
  const daysSinceLast = todayDays === null ? null : Math.max(0, todayDays - last.day);

  const ticks: Tick[] = dated.map((d) => ({
    id: d.id,
    sequenceNo: d.sequenceNo,
    date: d.dreamtOn,
    // A single-day corpus has no span to position across — centre it.
    pct: span === 0 ? 50 : ((d.day - first.day) / span) * 100,
    analyzed: d.analysisCount > 0,
  }));

  return {
    ticks,
    firstDate: first.dreamtOn,
    lastDate: last.dreamtOn,
    spanDays: span,
    daysSinceLast,
    longestGap: dated.length > 1 ? longestGap : null,
    dated: dated.length,
    undated,
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDay(iso: string): string {
  const m = iso.match(DATE_RE);
  if (!m) return iso;
  const [, y, mo, d] = m;
  return `${MONTHS[Number(mo) - 1] ?? mo} ${Number(d)} ${y}`;
}

/** Short form for the timeline caption: "May 17". */
export function formatDayShort(iso: string): string {
  const m = iso.match(DATE_RE);
  if (!m) return iso;
  const [, , mo, d] = m;
  return `${MONTHS[Number(mo) - 1] ?? mo} ${Number(d)}`;
}
