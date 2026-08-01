import Link from "next/link";
import { requireUserId } from "@/lib/session";
import { listTrendRuns, listDreamDates, listDreams, type TrendRun } from "@/lib/queries";
import { formatDreamNumbers, formatStamp } from "@/lib/scope";
import ExportButton from "@/app/components/ExportButton";
import Header from "@/app/components/Header";
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
      <Header />
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>Trends</h1>
        <Link href="/">← Dreams</Link>
      </div>
      <p className="muted">
        Choose how much of the corpus to read. Every claim cites the dreams it rests on. Past runs
        are kept and never overwritten.
      </p>

      <div style={{ margin: "18px 0" }}>
        {dreams.length === 0 ? (
          <p className="muted">Record a dream first — there is nothing to look across yet.</p>
        ) : (
          <TrendRunner dreams={dreams} analyzedCount={analyzedCount} />
        )}
      </div>

      {runs.length > 0 && <h2>Past runs</h2>}
      {runs.length === 0 ? (
        <p className="muted">No trend runs yet.</p>
      ) : (
        <div className="stack">
          {runs.map((run) => (
            <details key={run.id} className="run">
              <summary>
                <div>
                  <div className="run-dreams">
                    {run.dreamNumbers.length > 0
                      ? `Dream${run.dreamNumbers.length === 1 ? "" : "s"} ${formatDreamNumbers(run.dreamNumbers)}`
                      : run.scopeLabel}
                  </div>
                  <div className="seq">
                    {formatStamp(run.createdAt)} ·{" "}
                    {run.source === "dreams_and_analyses"
                      ? "read dreams + analyses"
                      : "read dreams"}
                  </div>
                </div>
              </summary>

              <div className="run-body">
                {run.body && <p style={{ whiteSpace: "pre-wrap", marginTop: 0 }}>{run.body}</p>}

                <div className="stack" style={{ marginTop: 14 }}>
                  {run.claims.length === 0 ? (
                    <p className="muted">No cited claims in this run.</p>
                  ) : (
                    run.claims.map((c, i) => (
                      <div key={i}>
                        <div>{c.claim}</div>
                        <div className="seq" style={{ marginTop: 4 }}>
                          dreams:{" "}
                          {c.citations.map((cit, j) => (
                            <span key={cit.id}>
                              {j > 0 ? ", " : ""}
                              <Link href={`/dreams/${cit.id}`}>#{cit.number}</Link>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {run.closing && (
                  <div className="closing">
                    <div className="seq" style={{ marginBottom: 6 }}>In sum</div>
                    <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{run.closing}</p>
                  </div>
                )}

                <div className="seq" style={{ marginTop: 16 }}>
                  {run.scopeLabel} · {run.corpusSize} read · {run.model} · {run.promptVersion}
                </div>
                <div style={{ marginTop: 12 }}>
                  <ExportButton text={buildTrendExport(run)} label="Copy run as text" />
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
