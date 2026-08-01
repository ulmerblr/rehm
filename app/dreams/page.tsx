import Link from "next/link";
import { requireUserId } from "@/lib/session";
import { listDreams } from "@/lib/queries";
import AnalyzeInline from "@/app/components/AnalyzeInline";
import { resolveView } from "@/lib/viewLang";
import { loadTranslations, display } from "@/lib/translations";

export const dynamic = "force-dynamic";

// A log, not a feed: ordinal in the left margin, hairlines between entries,
// no cards.
export default async function DreamLog({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const userId = await requireUserId();
  const view = await resolveView(userId);
  const t = view.t;
  const { show } = await searchParams;
  const all = await listDreams(userId);

  const onlyUnanalyzed = show === "unanalyzed";
  const dreams = onlyUnanalyzed ? all.filter((d) => d.analysisCount === 0) : all;

  // One lookup for the whole page rather than one per row.
  const tr = await loadTranslations(
    userId,
    view.lang,
    dreams.flatMap((d) => [
      { type: "title" as const, id: d.id },
      { type: "dream" as const, id: d.id },
    ])
  );

  return (
    <main>
      <h1>{t.log}</h1>

      {onlyUnanalyzed && (
        <p className="row" style={{ gap: 14, marginTop: -6, marginBottom: 18 }}>
          <span className="stamp stamp-flag">
            {t.showingNotAnalyzed(dreams.length)}
          </span>
          <Link href="/dreams" className="stamp" style={{ textDecoration: "none" }}>
            {t.showAll(all.length)}
          </Link>
        </p>
      )}

      {dreams.length === 0 ? (
        <p className="said">
          {onlyUnanalyzed ? (
            <>
              {t.everythingAnalyzed}{" "}
              <Link href="/dreams">{t.showWholeLog}</Link>.
            </>
          ) : (
            <>
              {t.nothingLoggedYet}{" "}
              <Link href="/record">{t.recordADream}</Link> {t.andItWillBeFirst}
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
                  <div className="log-title">
                    {display(d.title, tr, "title", d.id).text}
                  </div>
                  <div className="log-excerpt">
                    {display(d.snippet, tr, "dream", d.id).text}
                  </div>
                </Link>
                <div className="log-meta">
                  {d.dreamtOn && <span className="stamp">{t.formatDate(d.dreamtOn)}</span>}
                  <AnalyzeInline dreamId={d.id} count={d.analysisCount} lang={view.lang} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
