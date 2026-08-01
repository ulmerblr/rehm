import Link from "next/link";
import { requireUserId } from "@/lib/session";
import { listTrendRuns, listDreamDates, listDreams, type TrendRun } from "@/lib/queries";
import { formatStamp } from "@/lib/scope";
import ExportButton from "@/app/components/ExportButton";
import TrendRunner from "./TrendRunner";

export const dynamic = "force-dynamic";

export default async function Trends() {
  const userId = await requireUserId();
  const [runs, dreams, dreamList] = await Promise.all([
    listTrendRuns(userId),
    listDreamDates(userId),
    listDreams(userId),
  ]);
  const analyzedCount = dreamList.filter((d) => d.analysisCount > 0).length;

  return (
    <main>
      <h1>Trends</h1>
      <p className="machine">
        Every claim cites the dreams it rests on. A pass is kept at the corpus size
        it was drawn from, and never overwritten.
      </p>

      <div style={{ margin: "22px 0 34px" }}>
        {dreams.length === 0 ? (
          <p className="said">Record a dream first — there is nothing to read across yet.</p>
        ) : (
          <TrendRunner dreams={dreams} analyzedCount={analyzedCount} />
        )}
      </div>

      {runs.length === 0 ? (
        <p className="stamp">no passes yet</p>
      ) : (
        <div>
          {runs.map((run) => (
            <details key={run.id} className="run">
              <summary>
                <span className="run-corpus">corpus {run.corpusSize}</span>
                <span className="stamp">
                  {formatStamp(run.createdAt)}
                  {run.source === "dreams_and_analyses" ? " · + analyses" : ""}
                </span>
              </summary>

              <div className="run-body">
                {run.body && (
                  <p className="machine" style={{ whiteSpace: "pre-wrap" }}>
                    {run.body}
                  </p>
                )}

                <div style={{ marginTop: 18 }}>
                  {run.claims.length === 0 ? (
                    <p className="stamp">no cited claims</p>
                  ) : (
                    run.claims.map((c, i) => (
                      <div key={i} className="claim">
                        <div className="machine">{c.claim}</div>
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
                      in sum
                    </div>
                    <div className="machine" style={{ whiteSpace: "pre-wrap" }}>
                      {run.closing}
                    </div>
                  </div>
                )}

                <div className="stamp stamp-machine" style={{ marginTop: 20 }}>
                  {run.scopeLabel} · {run.model} · {run.promptVersion}
                </div>
                <div style={{ marginTop: 14 }}>
                  <ExportButton text={buildTrendExport(run)} label="Copy as text" />
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
