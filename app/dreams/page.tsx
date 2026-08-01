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
  return `${MONTHS[Number(mo) - 1] ?? mo} ${Number(d)}, ${y}`;
}

export default async function DreamLog() {
  const userId = await requireUserId();
  const dreams = await listDreams(userId);

  return (
    <main>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>Dream log</h1>
        <span className="seq">
          {dreams.length} dream{dreams.length === 1 ? "" : "s"}
        </span>
      </div>

      {dreams.length === 0 ? (
        <div className="card" style={{ textAlign: "center" }}>
          <p className="muted" style={{ margin: 0 }}>
            Nothing logged yet. <Link href="/record">Record a dream</Link> to start.
          </p>
        </div>
      ) : (
        <div className="stack" style={{ marginTop: 14 }}>
          {dreams.map((d) => (
            <div key={d.id} className="card dream-row" style={{ margin: 0 }}>
              <Link href={`/dreams/${d.id}`} className="card-link">
                <div className="dream-title">{d.title}</div>
                <div className="dream-snippet">{d.snippet}</div>
              </Link>
              <div className="dream-meta">
                <span className="seq">
                  Dream {d.sequenceNo}
                  {d.dreamtOn ? ` · ${formatDreamDate(d.dreamtOn)}` : ""}
                </span>
                <AnalyzeInline dreamId={d.id} count={d.analysisCount} />
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
