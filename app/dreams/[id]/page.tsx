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
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 18 }}>
        <span className="stamp">
          dream {String(dream.sequenceNo).padStart(2, "0")}
          {dream.dreamtOn ? ` · ${dream.dreamtOn}` : ""}
          {dream.captureMethod ? ` · ${dream.captureMethod}` : ""}
        </span>
        <Link href="/dreams" className="stamp" style={{ textDecoration: "none" }}>
          ← log
        </Link>
      </div>

      <EditableTitle
        dreamId={dream.id}
        initialTitle={dream.title}
        isCustom={dream.titleIsCustom}
      />

      {/* Testimony. First, largest, unadorned — it is the document. */}
      <div className="testimony" style={{ marginTop: 22 }}>
        {dream.rawTranscript}
      </div>

      {addenda.length > 0 && (
        <div className="stack" style={{ marginTop: 26 }}>
          {addenda.map((a) => (
            <div key={a.addendumNo} className="addendum">
              <div className="stamp" style={{ marginBottom: 6 }}>
                added {a.capturedAt ? formatStamp(a.capturedAt) : "later"}
              </div>
              <div className="testimony">{a.body}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 22 }}>
        <AddAddendum dreamId={dream.id} />
      </div>

      <h2>Restatement</h2>
      {restatement && restatement.accepted ? (
        <>
          <div className="derived">
            <div className="stamp stamp-machine" style={{ marginBottom: 8 }}>
              {restatement.model} · {restatement.promptVersion} · accepted
            </div>
            <div className="machine" style={{ whiteSpace: "pre-wrap" }}>
              {restatement.latestProposal}
            </div>
          </div>

          {restatement.turns.length > 0 && (
            <details style={{ marginTop: 18 }}>
              <summary className="stamp">{restatement.turns.length} loop turns</summary>
              <div className="stack" style={{ marginTop: 14 }}>
                {restatement.turns.map((t) => (
                  <div key={t.turnNo}>
                    <div
                      className={t.role === "objection" ? "stamp" : "stamp stamp-machine"}
                      style={{ marginBottom: 6 }}
                    >
                      {t.turnNo} · {t.role === "objection" ? "you" : "machine"}
                    </div>
                    <div className={t.role === "objection" ? "turn-said" : "turn-machine"}>
                      {t.body}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      ) : restatement ? (
        <>
          <p className="stamp stamp-flag" style={{ marginBottom: 14 }}>
            open — not accepted
          </p>
          <RestatementLoop
            restatementId={restatement.id}
            dreamId={dream.id}
            initialProposal={restatement.latestProposal}
          />
        </>
      ) : (
        <p className="machine">No restatement.</p>
      )}

      <h2>Analyses</h2>
      <p className="machine" style={{ marginTop: 0 }}>
        Generated from the transcript alone. Re-runnable — each run is kept.
      </p>
      <DreamActions dreamId={dream.id} />
      <div className="stack" style={{ marginTop: 18 }}>
        {analyses.length === 0 ? (
          <p className="stamp stamp-flag">not analyzed</p>
        ) : (
          analyses.map((a) => (
            <div key={a.id} className="derived">
              <div className="stamp stamp-machine" style={{ marginBottom: 8 }}>
                {a.createdAt.slice(0, 10)} · {a.model} · {a.promptVersion}
                {a.blind ? " · blind" : ""}
              </div>
              <div className="machine" style={{ whiteSpace: "pre-wrap" }}>
                {a.body}
              </div>
            </div>
          ))
        )}
      </div>

      <h2>Export</h2>
      <ExportButton text={exportText} label="Copy as text" />

      <h2>Delete</h2>
      <p className="machine" style={{ marginTop: 0 }}>
        Permanent, and it takes the restatement, analyses, and any trend citations
        with it. Copy the text first if you want a record.
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
