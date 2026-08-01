import Link from "next/link";
import { requireUserId } from "@/lib/session";
import { listTrendRuns, listDreamDates, type TrendRun } from "@/lib/queries";
import ExportButton from "@/app/components/ExportButton";
import Header from "@/app/components/Header";
import TrendRunner from "./TrendRunner";

export const dynamic = "force-dynamic";

export default async function Trends() {
  const userId = await requireUserId();
  const [runs, dreams] = await Promise.all([listTrendRuns(userId), listDreamDates(userId)]);

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
          <TrendRunner dreams={dreams} />
        )}
      </div>

      {runs.length > 0 && <h2>Past runs</h2>}
      {runs.length === 0 ? (
        <p className="muted">No trend runs yet.</p>
      ) : (
        runs.map((run) => (
          <div key={run.id} className="card">
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{run.scopeLabel}</div>
            <div>
              <span className="tag">{run.corpusSize} dreams read</span>
              <span className="tag">model: {run.model}</span>
              <span className="tag">prompt: {run.promptVersion}</span>
            </div>
            <div className="seq">{run.createdAt}</div>
            {run.body && <p style={{ whiteSpace: "pre-wrap" }}>{run.body}</p>}

            <div className="stack" style={{ marginTop: 8 }}>
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

            <div style={{ marginTop: 14 }}>
              <ExportButton text={buildTrendExport(run)} label="Copy run as text" />
            </div>
          </div>
        ))
      )}
    </main>
  );
}

function buildTrendExport(run: TrendRun): string {
  const parts: string[] = [];
  parts.push(
    `TREND RUN ${run.createdAt} — ${run.scopeLabel} (model=${run.model}, prompt_version=${run.promptVersion}, corpus_size=${run.corpusSize})`
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
  return parts.join("\n");
}
