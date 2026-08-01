import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserId } from "@/lib/session";
import { getDream, getRestatementState, getAnalyses, getAddenda } from "@/lib/queries";
import { formatStamp } from "@/lib/scope";
import ExportButton from "@/app/components/ExportButton";
import RestatementLoop from "@/app/components/RestatementLoop";
import DreamActions from "./DreamActions";
import DeleteDream from "./DeleteDream";
import EditableTitle from "./EditableTitle";
import AddAddendum from "./AddAddendum";

export const dynamic = "force-dynamic";

export default async function DreamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await requireUserId();
  const { id } = await params;
  const dream = await getDream(id, userId);
  if (!dream) notFound();

  const [restatement, analyses, addenda] = await Promise.all([
    getRestatementState(dream.id),
    getAnalyses(dream.id),
    getAddenda(dream.id),
  ]);

  const exportText = buildExport(dream, restatement, analyses, addenda);

  return (
    <main>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>Dream {dream.sequenceNo}</h1>
        <Link href="/dreams">← Log</Link>
      </div>
      <EditableTitle
        dreamId={dream.id}
        initialTitle={dream.title}
        isCustom={dream.titleIsCustom}
      />
      <p className="seq">
        {dream.dreamtOn ?? "no date"}
        {dream.captureMethod ? (
          <span className="tag" style={{ marginLeft: 10 }}>{dream.captureMethod}</span>
        ) : null}
      </p>

      <h2>Raw transcript</h2>
      <div className="verbatim">{dream.rawTranscript}</div>

      <h2>Additions</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Things that came back to you later. Added to the record, never replacing it.
      </p>
      {addenda.length > 0 && (
        <div className="stack" style={{ marginBottom: 14 }}>
          {addenda.map((a) => (
            <div key={a.addendumNo} className="addendum">
              <div className="seq">
                Added {a.capturedAt ? formatStamp(a.capturedAt) : "later"}
              </div>
              <div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{a.body}</div>
            </div>
          ))}
        </div>
      )}
      <AddAddendum dreamId={dream.id} />

      <h2>Restatement</h2>
      {restatement && restatement.accepted ? (
        <>
          <div className="card">
            <div>
              <span className="tag">model: {restatement.model}</span>
              <span className="tag">prompt: {restatement.promptVersion}</span>
            </div>
            <p style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>
              {restatement.latestProposal}
            </p>
          </div>
          {restatement.turns.length > 0 && (
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
        </>
      ) : restatement ? (
        <>
          <p className="muted" style={{ marginTop: 0 }}>
            Not accepted yet — continue the loop until you agree.
          </p>
          <RestatementLoop
            restatementId={restatement.id}
            dreamId={dream.id}
            initialProposal={restatement.latestProposal}
          />
        </>
      ) : (
        <p className="muted">No restatement.</p>
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

      <h2 style={{ marginTop: 32, color: "var(--danger)" }}>Danger zone</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Deleting a dream is permanent. Consider copying it as text first.
      </p>
      <DeleteDream dreamId={dream.id} sequenceNo={dream.sequenceNo} />
    </main>
  );
}

function buildExport(
  dream: NonNullable<Awaited<ReturnType<typeof getDream>>>,
  restatement: Awaited<ReturnType<typeof getRestatementState>>,
  analyses: Awaited<ReturnType<typeof getAnalyses>>,
  addenda: Awaited<ReturnType<typeof getAddenda>>
): string {
  const parts: string[] = [];
  parts.push(`DREAM ${dream.sequenceNo} — ${dream.dreamtOn ?? "no date"}`);
  parts.push(`capture_method: ${dream.captureMethod ?? "(none)"}`);
  parts.push("");
  parts.push("RAW TRANSCRIPT");
  parts.push(dream.rawTranscript);
  if (addenda.length > 0) {
    parts.push("");
    parts.push("ADDITIONS (remembered afterwards)");
    for (const a of addenda) {
      parts.push(`--- added ${a.capturedAt ? a.capturedAt.slice(0, 10) : "later"}`);
      parts.push(a.body);
    }
  }
  if (restatement && restatement.turns.length > 0) {
    parts.push("");
    parts.push("RESTATEMENT LOOP");
    for (const t of restatement.turns) {
      parts.push(`[${t.turnNo}] ${t.role.toUpperCase()}: ${t.body}`);
    }
  }
  if (restatement && restatement.accepted && restatement.latestProposal) {
    parts.push("");
    parts.push(
      `ACCEPTED RESTATEMENT (model=${restatement.model}, prompt_version=${restatement.promptVersion})`
    );
    parts.push(restatement.latestProposal);
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
