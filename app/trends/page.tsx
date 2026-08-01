import Link from "next/link";
import { requireOnboarded } from "@/lib/session";
import { listTrendRuns, listDreamDates, listDreams, type TrendRun } from "@/lib/queries";
import { formatDreamNumbers } from "@/lib/scope";
import ExportButton from "@/app/components/ExportButton";
import TrendRunner from "./TrendRunner";
import { resolveView } from "@/lib/viewLang";
import { loadTranslations, display } from "@/lib/translations";

export const dynamic = "force-dynamic";

export default async function Trends() {
  const userId = await requireOnboarded();
  const [runs, dreams, dreamList] = await Promise.all([
    listTrendRuns(userId),
    listDreamDates(userId),
    listDreams(userId),
  ]);
  const analyzedCount = dreamList.filter((d) => d.analysisCount > 0).length;
  const view = await resolveView(userId);
  const t = view.t;

  // A trend pass is the thing you'd most likely hand the phone over for, so
  // every closing and claim on the page is resolved in one lookup.
  const tr = await loadTranslations(userId, view.lang, [
    ...runs.map((r) => ({ type: "trend_summary" as const, id: r.id })),
    ...runs.map((r) => ({ type: "trend_closing" as const, id: r.id })),
    ...runs.flatMap((r) => r.claims.map((c) => ({ type: "trend_claim" as const, id: c.id }))),
  ]);

  return (
    <main>
      <h1>{t.trends}</h1>
      <p className="machine">{t.trendsIntro}</p>

      <div style={{ margin: "22px 0 34px" }}>
        {dreams.length === 0 ? (
          <p className="said">{t.nothingLoggedYet}</p>
        ) : (
          <TrendRunner dreams={dreams} analyzedCount={analyzedCount} lang={view.lang} />
        )}
      </div>

      {runs.length === 0 ? (
        <p className="stamp">{t.noTrendsYet}</p>
      ) : (
        <div>
          {runs.map((run) => (
            <details key={run.id} className="run">
              <summary>
                <span className="run-dreams">
                  {run.dreamNumbers.length > 0
                    ? t.dreamsPrefix(formatDreamNumbers(run.dreamNumbers))
                    : run.scopeLabel}
                </span>
                <span className="stamp">
                  {run.source === "dreams_and_analyses"
                    ? t.readDreamsAndAnalyses
                    : t.readDreamsOnly}{" "}
                  · {t.formatDate(run.createdAt)}
                </span>
              </summary>

              <div className="run-body">
                {run.body && (
                  <p className="machine" style={{ whiteSpace: "pre-wrap" }}>
                    {display(run.body, tr, "trend_summary", run.id).text}
                  </p>
                )}

                <div style={{ marginTop: 18 }}>
                  {run.claims.length === 0 ? (
                    <p className="stamp">{t.noCitedClaims}</p>
                  ) : (
                    run.claims.map((c, i) => (
                      <div key={c.id || i} className="claim">
                        <div className="machine">
                          {display(c.claim, tr, "trend_claim", c.id).text}
                        </div>
                        <div>
                          {c.citations.map((cit) => (
                            <Link key={cit.id} href={`/dreams/${cit.id}`} className="cite">
                              {String(cit.number).padStart(2, "0")}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {run.closing && (
                  <div className="closing">
                    <div className="stamp stamp-machine" style={{ marginBottom: 8 }}>
                      {t.inSum}
                    </div>
                    <div className="machine" style={{ whiteSpace: "pre-wrap" }}>
                      {display(run.closing, tr, "trend_closing", run.id).text}
                    </div>
                  </div>
                )}

                <div className="stamp stamp-machine" style={{ marginTop: 20 }}>
                  {t.atNDreams(run.corpusSize)} · {run.scopeLabel} · {run.model} ·{" "}
                  {run.promptVersion}
                </div>
                <div style={{ marginTop: 14 }}>
                  <ExportButton text={buildTrendExport(run)} label={t.copyAsText} copiedLabel={t.copied} />
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
    </main>
  );
}

function buildTrendExport(run: TrendRun): string {
  const parts: string[] = [];
  parts.push(
    `TREND RUN ${run.createdAt} — ${run.scopeLabel} (source=${run.source}, model=${run.model}, prompt_version=${run.promptVersion}, corpus_size=${run.corpusSize})`
  );
  if (run.body) {
    parts.push("");
    parts.push(run.body);
  }
  parts.push("");
  parts.push("CLAIMS");
  for (const c of run.claims) {
    const cites = c.citations.map((cit) => `#${cit.number}`).join(", ");
    parts.push(`- ${c.claim}  [dreams: ${cites}]`);
  }
  if (run.closing) {
    parts.push("");
    parts.push("IN SUM");
    parts.push(run.closing);
  }
  return parts.join("\n");
}
