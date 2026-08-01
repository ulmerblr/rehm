import Link from "next/link";
import { requireUserId } from "@/lib/session";
import { listDreams } from "@/lib/queries";
import { buildCorpus, formatDayShort } from "@/lib/corpus";
import { resolveView } from "@/lib/viewLang";
import { loadTranslations, display } from "@/lib/translations";

export const dynamic = "force-dynamic";

// A longitudinal study lives or dies on cadence, not just sample size: nine
// dreams across three days is a different instrument from nine across six
// months. So the dashboard reports the shape of the record — when it was fed,
// and where the silences are — before anything derived from it.
export default async function Home() {
  const userId = await requireUserId();
  const view = await resolveView(userId);
  const t = view.t;
  const dreams = await listDreams(userId);
  const corpus = buildCorpus(dreams);

  const latest = dreams[0] ?? null;
  // Only the newest dream's words appear here, so only its title and transcript
  // need looking up. Empty map on a single-language account, which renders the
  // originals — the correct fallback in every case.
  const tr = latest
    ? await loadTranslations(userId, view.lang, [
        { type: "title", id: latest.id },
        { type: "dream", id: latest.id },
      ])
    : new Map<string, string>();
  const latestTitle = latest ? display(latest.title, tr, "title", latest.id) : null;
  const latestSnippet = latest ? display(latest.snippet, tr, "dream", latest.id) : null;
  const unanalyzed = dreams.filter((d) => d.analysisCount === 0).length;

  return (
    <main>
      <Link href="/record" className="btn btn-primary btn-block btn-lg">
        {t.recordADream}
      </Link>

      {dreams.length === 0 ? (
        <p className="said" style={{ marginTop: 40 }}>
          {t.nothingRecordedYet}
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
              <div className="said-title">{latestTitle?.text}</div>
              <div className={latestSnippet?.translated ? "machine lede-excerpt" : "said lede-excerpt"}>
                {latestSnippet?.text}
              </div>
            </Link>
          )}

          {corpus.ticks.length > 0 && (
            <>
              <div className="timeline">
                {corpus.ticks.map((tick) => (
                  <Link
                    key={tick.id}
                    href={`/dreams/${tick.id}`}
                    className={tick.analyzed ? "tick" : "tick tick-open"}
                    style={{ left: `${tick.pct}%` }}
                    aria-label={`${tick.sequenceNo} · ${tick.date}${
                      tick.analyzed ? "" : ` · ${t.notAnalyzed}`
                    }`}
                  />
                ))}
              </div>
              <div className="timeline-caption">
                <span className="stamp">
                  {formatDayShort(corpus.firstDate as string)} —{" "}
                  {formatDayShort(corpus.lastDate as string)}
                </span>
                <span className="stamp">
                  {corpus.spanDays === null ? "—" : t.days(corpus.spanDays)}
                  {corpus.undated > 0 ? ` · ${t.undated(corpus.undated)}` : ""}
                </span>
              </div>
            </>
          )}

          <div className="figures">
            <div>
              <div className="figure-value">{dreams.length}</div>
              <div className="figure-label">{t.dreamsRecorded(dreams.length)}</div>
            </div>
            <div>
              <div className="figure-value">
                {corpus.daysSinceLast === null ? "—" : corpus.daysSinceLast}
              </div>
              <div className="figure-label">{t.daysSinceLast}</div>
            </div>
            <div>
              <div className="figure-value">
                {corpus.longestGap === null ? "—" : corpus.longestGap}
              </div>
              <div className="figure-label">{t.longestGap}</div>
            </div>
          </div>

          {unanalyzed > 0 && (
            <Link href="/dreams?show=unanalyzed" className="unresolved">
              {t.notAnalyzedCount(unanalyzed)}
            </Link>
          )}
        </>
      )}
    </main>
  );
}
