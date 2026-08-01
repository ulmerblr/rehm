import Link from "next/link";
import { requireUserId } from "@/lib/session";
import { listDreams, getUserEmail } from "@/lib/queries";
import Header from "@/app/components/Header";
import ProfileChip from "@/app/components/ProfileChip";
import AnalyzeInline from "@/app/components/AnalyzeInline";

export const dynamic = "force-dynamic";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Format a YYYY-MM-DD string without going through Date() (which would shift the
// day across timezones). Falls back to the raw string if it isn't as expected.
function formatDreamDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const [, y, mo, d] = m;
  const month = MONTHS[Number(mo) - 1] ?? mo;
  return `${month} ${Number(d)}, ${y}`;
}

export default async function Home() {
  const userId = await requireUserId();
  const [dreams, email] = await Promise.all([listDreams(userId), getUserEmail(userId)]);

  return (
    <main>
      <Header right={<ProfileChip email={email} />} />

      <Link href="/record" className="btn btn-primary btn-block btn-lg" style={{ marginTop: 4 }}>
        Record a dream
      </Link>

      <div className="row section-head" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>
          Your dreams{dreams.length > 0 ? ` · ${dreams.length}` : ""}
        </h2>
        <Link href="/trends">Trends →</Link>
      </div>

      {dreams.length === 0 ? (
        <div className="card" style={{ textAlign: "center" }}>
          <p className="muted" style={{ margin: 0 }}>
            No dreams yet. Tap <strong>Record a dream</strong> to capture your first one.
          </p>
        </div>
      ) : (
        <div className="stack" style={{ marginTop: 8 }}>
          {dreams.map((d) => (
            <div key={d.id} className="card dream-row" style={{ margin: 0 }}>
              <Link href={`/dreams/${d.id}`} className="card-link">
                <div className="dream-title">{d.title}</div>
                <div className="dream-snippet">{d.snippet}</div>
                <div className="seq" style={{ marginTop: 6 }}>
                  Dream {d.sequenceNo}
                  {d.dreamtOn ? ` · ${formatDreamDate(d.dreamtOn)}` : ""}
                </div>
              </Link>
              <div className="row" style={{ marginTop: 10 }}>
                <AnalyzeInline dreamId={d.id} count={d.analysisCount} />
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
