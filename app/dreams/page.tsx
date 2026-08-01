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
export default async function DreamLog() {
  const userId = await requireUserId();
  const dreams = await listDreams(userId);

  return (
    <main>
      <h1>Log</h1>

      {dreams.length === 0 ? (
        <p className="said">
          Nothing logged yet. <Link href="/record">Record a dream</Link> and it will
          be the first entry.
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
