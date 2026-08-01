import Link from "next/link";
import { requireUserId } from "@/lib/session";
import { getDashboardStats } from "@/lib/queries";

export const dynamic = "force-dynamic";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Format YYYY-MM-DD without Date(), which would shift the day across timezones.
function formatDreamDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const [, y, mo, d] = m;
  return `${MONTHS[Number(mo) - 1] ?? mo} ${Number(d)} ${y}`;
}

// The last dream is the hero — not a stat block. Enough of the transcript is
// shown that you start reading it, in the dreamer's own type.
export default async function Home() {
  const userId = await requireUserId();
  const stats = await getDashboardStats(userId);
  const unanalyzed = stats.dreams - stats.analyzedDreams;

  return (
    <main>
      <Link href="/record" className="btn btn-primary btn-block btn-lg">
        Record a dream
      </Link>

      {!stats.lastDream ? (
        <div style={{ marginTop: 40 }}>
          <p className="said" style={{ marginBottom: 18 }}>
            Nothing recorded yet. The first one can be a fragment — a room, a face,
            the one image that stayed.
          </p>
        </div>
      ) : (
        <>
          <Link
            href={`/dreams/${stats.lastDream.id}`}
            style={{ display: "block", textDecoration: "none", marginTop: 38 }}
          >
            <span className="lede-seq">
              {String(stats.lastDream.sequenceNo).padStart(2, "0")}
            </span>
            <div className="said-title">{stats.lastDream.title}</div>
            <div className="said lede-excerpt">{stats.lastDreamExcerpt}</div>
          </Link>

          <div className="ledger">
            <span className="stamp">
              {stats.dreams} dream{stats.dreams === 1 ? "" : "s"}
            </span>
            {stats.lastDream.dreamtOn && (
              <span className="stamp">last {formatDreamDate(stats.lastDream.dreamtOn)}</span>
            )}
            <span className="stamp">
              {stats.lastTrendCorpus === null
                ? "no trend pass"
                : `trend at corpus ${stats.lastTrendCorpus}`}
            </span>
            {unanalyzed > 0 && (
              <Link href="/dreams" className="stamp stamp-flag" style={{ textDecoration: "none" }}>
                {unanalyzed} unanalyzed
              </Link>
            )}
          </div>
        </>
      )}
    </main>
  );
}
