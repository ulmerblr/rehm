import Link from "next/link";
import { requireUserId } from "@/lib/session";
import { listDreams } from "@/lib/queries";
import AnalyzeInline from "@/app/components/AnalyzeInline";

export const dynamic = "force-dynamic";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Format YYYY-MM-DD without Date(), which would shift the day across timezones.
function formatDreamDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const [, y, mo, d] = m;
  return `${MONTHS[Number(mo) - 1] ?? mo} ${Number(d)} ${y}`;
}

// A log, not a feed: ordinal in the left margin, hairlines between entries,
// no cards.
export default async function DreamLog({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const userId = await requireUserId();
  const { show } = await searchParams;
  const all = await listDreams(userId);

  const onlyUnanalyzed = show === "unanalyzed";
  const dreams = onlyUnanalyzed ? all.filter((d) => d.analysisCount === 0) : all;

  return (
    <main>
      <h1>Log</h1>

      {onlyUnanalyzed && (
        <p className="row" style={{ gap: 14, marginTop: -6, marginBottom: 18 }}>
          <span className="stamp stamp-flag">
            showing {dreams.length} not analyzed
          </span>
          <Link href="/dreams" className="stamp" style={{ textDecoration: "none" }}>
            show all {all.length}
          </Link>
        </p>
      )}

      {dreams.length === 0 ? (
        <p className="said">
          {onlyUnanalyzed ? (
            <>
              Everything is analyzed. <Link href="/dreams">Show the whole log</Link>.
            </>
          ) : (
            <>
              Nothing logged yet. <Link href="/record">Record a dream</Link> and it
              will be the first entry.
            </>
          )}
        </p>
      ) : (
        <div>
          {dreams.map((d) => (
            <div key={d.id} className="log-row">
              <div className="log-seq">{String(d.sequenceNo).padStart(2, "0")}</div>
              <div style={{ minWidth: 0 }}>
                <Link href={`/dreams/${d.id}`} style={{ textDecoration: "none", display: "block" }}>
                  <div className="log-title">{d.title}</div>
                  <div className="log-excerpt">{d.snippet}</div>
                </Link>
                <div className="log-meta">
                  {d.dreamtOn && <span className="stamp">{formatDreamDate(d.dreamtOn)}</span>}
                  <AnalyzeInline dreamId={d.id} count={d.analysisCount} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
