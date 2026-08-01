import Link from "next/link";
import { requireUserId } from "@/lib/session";
import { getDashboardStats, getUserEmail } from "@/lib/queries";
import { formatStamp } from "@/lib/scope";
import Header from "@/app/components/Header";
import ProfileChip from "@/app/components/ProfileChip";

export const dynamic = "force-dynamic";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Format YYYY-MM-DD without Date(), which would shift the day across timezones.
function formatDreamDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const [, y, mo, d] = m;
  return `${MONTHS[Number(mo) - 1] ?? mo} ${Number(d)}, ${y}`;
}

export default async function Home() {
  const userId = await requireUserId();
  const [stats, email] = await Promise.all([getDashboardStats(userId), getUserEmail(userId)]);

  const unanalyzed = stats.dreams - stats.analyzedDreams;

  return (
    <main>
      <Header right={<ProfileChip email={email} />} />

      <Link href="/record" className="btn btn-primary btn-block btn-lg" style={{ marginTop: 4 }}>
        Record a dream
      </Link>

      {stats.dreams === 0 ? (
        <div className="card" style={{ textAlign: "center", marginTop: 22 }}>
          <p className="muted" style={{ margin: 0 }}>
            No dreams yet. Record your first one and this page will start keeping count.
          </p>
        </div>
      ) : (
        <>
          {/* One hero figure per view: the size of the corpus. */}
          <div className="hero" style={{ marginTop: 26 }}>
            <div className="hero-figure">{stats.dreams.toLocaleString()}</div>
            <div className="muted">
              dream{stats.dreams === 1 ? "" : "s"} recorded
            </div>
          </div>

          <div className="stat-row">
            <div className="stat">
              <div className="stat-label">Analyzed</div>
              <div className="stat-value">
                {stats.analyzedDreams}
                <span className="stat-of"> of {stats.dreams}</span>
              </div>
            </div>
            <div className="stat">
              <div className="stat-label">Analyses run</div>
              <div className="stat-value">{stats.analyses}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Trend passes</div>
              <div className="stat-value">{stats.trendRuns}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Later additions</div>
              <div className="stat-value">{stats.additions}</div>
            </div>
          </div>

          {unanalyzed > 0 && (
            <Link href="/dreams" className="card card-link nudge">
              <span className="status status-warn">
                {unanalyzed} dream{unanalyzed === 1 ? "" : "s"} not analyzed
              </span>
              <span className="seq">Open the log →</span>
            </Link>
          )}

          {stats.lastDream && (
            <>
              <h2>Last recorded</h2>
              <Link
                href={`/dreams/${stats.lastDream.id}`}
                className="card card-link"
                style={{ marginTop: 0 }}
              >
                <div className="dream-title">{stats.lastDream.title}</div>
                <div className="dream-snippet">{stats.lastDream.snippet}</div>
                <div className="seq" style={{ marginTop: 8 }}>
                  Dream {stats.lastDream.sequenceNo}
                  {stats.lastDream.dreamtOn
                    ? ` · ${formatDreamDate(stats.lastDream.dreamtOn)}`
                    : ""}
                </div>
              </Link>
            </>
          )}

          {stats.lastTrendAt && (
            <p className="muted" style={{ fontSize: "0.9rem" }}>
              Last trend pass {formatStamp(stats.lastTrendAt)}.{" "}
              <Link href="/trends">Trends →</Link>
            </p>
          )}
        </>
      )}
    </main>
  );
}
