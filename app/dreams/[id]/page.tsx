import Link from "next/link";
import { notFound } from "next/navigation";
import { getDream, getAcceptedRestatement, getAnalyses } from "@/lib/queries";
import ExportButton from "@/app/components/ExportButton";
import DreamActions from "./DreamActions";

export const dynamic = "force-dynamic";

export default async function DreamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dream = await getDream(id);
  if (!dream) notFound();

  const [restatement, analyses] = await Promise.all([
    getAcceptedRestatement(dream.id),
    getAnalyses(dream.id),
  ]);

  // Plain-text export: raw + loop turns + accepted restatement + analyses.
  const exportText = buildExport(dream, restatement, analyses);

  return (
    <main>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>Dream {dream.sequenceNo}</h1>
        <Link href="/">← Dreams</Link>
      </div>
      <p className="seq">
        {dream.dreamtOn ?? "no date"}
        {dream.captureMethod ? <span className="tag" style={{ marginLeft: 10 }}>{dream.captureMethod}</span> : null}
      </p>

      <h2>Raw transcript</h2>
      <div className="verbatim">{dream.rawTranscript}</div>

      <h2>Accepted restatement</h2>
      {restatement ? (
        <div className="card">
          <div>
            <span className="tag">model: {restatement.model}</span>
            <span className="tag">prompt: {restatement.promptVersion}</span>
          </div>
          <p style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{restatement.text}</p>
        </div>
      ) : (
        <p className="muted">Not accepted yet.</p>
      )}

      {restatement && restatement.turns.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary>Loop turns ({restatement.turns.length})</summary>
          <div className="stack" style={{ padding: "8px 0 14px" }}>
            {restatement.turns.map((t) => (
              <div key={t.turnNo}>
                <div className="seq">
                  {t.turnNo}. {t.role === "proposal" ? "Proposal" : "Objection"}
                </div>
                <div style={{ whiteSpace: "pre-wrap" }}>{t.body}</div>
              </div>
            ))}
          </div>
        </details>
      )}

      <h2>Analyses</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Blind — generated from the raw transcript only. Re-runnable; each run is a new row.
      </p>
      <DreamActions dreamId={dream.id} />
      <div className="stack" style={{ marginTop: 14 }}>
        {analyses.length === 0 ? (
          <p className="muted">No analyses yet.</p>
        ) : (
          analyses.map((a) => (
            <div key={a.id} className="card">
              <div>
                <span className="tag">model: {a.model}</span>
                <span className="tag">prompt: {a.promptVersion}</span>
                <span className="tag">blind: {String(a.blind)}</span>
              </div>
              <div className="seq">{a.createdAt}</div>
              <p style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{a.body}</p>
            </div>
          ))
        )}
      </div>

      <h2>Export</h2>
      <ExportButton text={exportText} label="Copy dream as text" />
    </main>
  );
}

function buildExport(
  dream: NonNullable<Awaited<ReturnType<typeof getDream>>>,
  restatement: Awaited<ReturnType<typeof getAcceptedRestatement>>,
  analyses: Awaited<ReturnType<typeof getAnalyses>>
): string {
  const parts: string[] = [];
  parts.push(`DREAM ${dream.sequenceNo} — ${dream.dreamtOn ?? "no date"}`);
  parts.push(`capture_method: ${dream.captureMethod ?? "(none)"}`);
  parts.push("");
  parts.push("RAW TRANSCRIPT");
  parts.push(dream.rawTranscript);
  if (restatement) {
    parts.push("");
    parts.push("RESTATEMENT LOOP");
    for (const t of restatement.turns) {
      parts.push(`[${t.turnNo}] ${t.role.toUpperCase()}: ${t.body}`);
    }
    parts.push("");
    parts.push(`ACCEPTED RESTATEMENT (model=${restatement.model}, prompt_version=${restatement.promptVersion})`);
    parts.push(restatement.text);
  }
  if (analyses.length > 0) {
    parts.push("");
    parts.push("ANALYSES");
    for (const a of analyses) {
      parts.push(`--- ${a.createdAt} (model=${a.model}, prompt_version=${a.promptVersion}, blind=${a.blind})`);
      parts.push(a.body);
    }
  }
  return parts.join("\n");
}
