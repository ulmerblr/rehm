import Link from "next/link";
import { requireUserId } from "@/lib/session";
import { listDreams } from "@/lib/queries";
import { buildCorpus, formatDayShort } from "@/lib/corpus";

export const dynamic = "force-dynamic";

// A longitudinal study lives or dies on cadence, not just sample size: nine
// dreams across three days is a different instrument from nine across six
// months. So the dashboard reports the shape of the record — when it was fed,
// and where the silences are — before anything derived from it.
export default async function Home() {
  const userId = await requireUserId();
  const dreams = await listDreams(userId);
  const corpus = buildCorpus(dreams);

  const latest = dreams[0] ?? null;
  const unanalyzed = dreams.filter((d) => d.analysisCount === 0).length;

  return (
    <main>
      <Link href="/record" className="btn btn-primary btn-block btn-lg">
        Record a dream
      </Link>

      {dreams.length === 0 ? (
        <p className="said" style={{ marginTop: 40 }}>
          Nothing recorded yet. The first one can be a fragment — a room, a face,
          the one image that stayed.
        </p>
      ) : (
        <>
          {/* The most recent dream sits directly under the record action — the
              thing you came to read, before any measurement of it. */}
          {latest && (
            <Link
              href={`/dreams/${latest.id}`}
              style={{ display: "block", textDecoration: "none", marginTop: 34 }}
            >
              <span className="lede-seq">
                {String(latest.sequenceNo).padStart(2, "0")}
              </span>
              <div className="said-title">{latest.title}</div>
              <div className="said lede-excerpt">{latest.snippet}</div>
            </Link>
          )}

          {corpus.ticks.length > 0 && (
            <>
              <div className="timeline">
                {corpus.ticks.map((t) => (
                  <Link
                    key={t.id}
                    href={`/dreams/${t.id}`}
                    className={t.analyzed ? "tick" : "tick tick-open"}
                    style={{ left: `${t.pct}%` }}
                    aria-label={`Dream ${t.sequenceNo}, ${t.date}${t.analyzed ? "" : ", not analyzed"}`}
                  />
                ))}
              </div>
              <div className="timeline-caption">
                <span className="stamp">
                  {formatDayShort(corpus.firstDate as string)} —{" "}
                  {formatDayShort(corpus.lastDate as string)}
                </span>
                <span className="stamp">
                  {corpus.spanDays} day{corpus.spanDays === 1 ? "" : "s"}
                  {corpus.undated > 0 ? ` · ${corpus.undated} undated` : ""}
                </span>
              </div>
            </>
          )}

          <div className="figures">
            <div>
              <div className="figure-value">{dreams.length}</div>
              <div className="figure-label">
                dream{dreams.length === 1 ? "" : "s"} recorded
              </div>
            </div>
            <div>
              <div className="figure-value">
                {corpus.daysSinceLast === null ? "—" : corpus.daysSinceLast}
              </div>
              <div className="figure-label">days since the last one</div>
            </div>
            <div>
              <div className="figure-value">
                {corpus.longestGap === null ? "—" : corpus.longestGap}
              </div>
              <div className="figure-label">days, longest gap</div>
            </div>
          </div>

          {unanalyzed > 0 && (
            <Link href="/dreams?show=unanalyzed" className="unresolved">
              {unanalyzed} dream{unanalyzed === 1 ? "" : "s"} not analyzed
            </Link>
          )}
        </>
      )}
    </main>
  );
}
