import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOnboarded } from "@/lib/session";
import {
  getDream,
  getRestatementState,
  getAnalyses,
  getAddenda,
  citationsForDream,
} from "@/lib/queries";
import { segmentByQuotations, segmentTranslated } from "@/lib/spans";
import ExportButton from "@/app/components/ExportButton";
import RestatementLoop from "@/app/components/RestatementLoop";
import { CitationProvider } from "@/app/components/Citations";
import AnalysisBody from "@/app/components/AnalysisBody";
import CitedTranscript from "@/app/components/CitedTranscript";
import DreamActions from "./DreamActions";
import DeleteDream from "./DeleteDream";
import EditableTitle from "./EditableTitle";
import AddAddendum from "./AddAddendum";
import { resolveView } from "@/lib/viewLang";
import { loadTranslations, display } from "@/lib/translations";

export const dynamic = "force-dynamic";

export default async function DreamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await requireOnboarded();
  const { id } = await params;
  const dream = await getDream(id, userId);
  if (!dream) notFound();

  const [restatement, analyses, addenda, citations] = await Promise.all([
    getRestatementState(dream.id),
    getAnalyses(dream.id),
    getAddenda(dream.id),
    citationsForDream(dream.id, userId),
  ]);

  const view = await resolveView(userId);
  const t = view.t;

  const tr = await loadTranslations(userId, view.lang, [
    { type: "title", id: dream.id },
    { type: "dream", id: dream.id },
    ...addenda.map((a) => ({ type: "addendum" as const, id: a.id })),
    ...(restatement ? [{ type: "restatement" as const, id: restatement.id }] : []),
    ...analyses.map((a) => ({ type: "analysis" as const, id: a.id })),
    // The claims resting on this transcript are shown in the margin panel, and
    // they are generated text like any other — they get the same treatment.
    ...citations.flatMap((c) => c.claims.map((cl) => ({ type: "trend_claim" as const, id: cl.id }))),
  ]);

  const citationsShown = citations.map((c) => ({
    ...c,
    claims: c.claims.map((cl) => ({
      id: cl.id,
      runCreatedAt: cl.runCreatedAt,
      claimShown: display(cl.claim, tr, "trend_claim", cl.id).text,
    })),
  }));

  const transcript = display(dream.rawTranscript, tr, "dream", dream.id);

  // The export is the record, so it is always the original. A translation is a
  // reading aid; handing one to someone as "the transcript" would be a lie.
  const exportText = buildExport(dream, restatement, analyses, addenda);

  return (
    <CitationProvider lang={view.lang}>
    <main>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 18 }}>
        <span className="stamp">
          {String(dream.sequenceNo).padStart(2, "0")}
          {dream.dreamtOn ? ` · ${t.formatDate(dream.dreamtOn)}` : ""}
          {dream.captureMethod ? ` · ${dream.captureMethod}` : ""}
        </span>
        <Link href="/dreams" className="stamp" style={{ textDecoration: "none" }}>
          ← {t.log}
        </Link>
      </div>

      <EditableTitle
        dreamId={dream.id}
        initialTitle={dream.title}
        isCustom={dream.titleIsCustom}
        displayTitle={display(dream.title, tr, "title", dream.id).text}
        translatedNote={t.machineTranslation}
        lang={view.lang}
      />

      {/* Testimony. First, largest, unadorned — it is the document.
          When it is being shown translated it drops out of the serif: those
          are not the words that were said, and the type says so.

          The gutter marks only appear on the original. Offsets index the
          transcript as spoken, and a translation is a different string of a
          different length — carrying them across would mark the wrong words. */}
      {transcript.translated ? (
        <div className="machine" style={{ marginTop: 22, whiteSpace: "pre-wrap" }}>
          {transcript.text}
        </div>
      ) : (
        <div style={{ marginTop: 22 }}>
          <CitedTranscript
            text={transcript.text}
            citations={citationsShown}
            lang={view.lang}
            className="testimony"
          />
        </div>
      )}
      {transcript.translated && (
        <span className="stamp stamp-machine translated-note">{t.machineTranslation}</span>
      )}

      {addenda.length > 0 && (
        <div className="stack" style={{ marginTop: 26 }}>
          {addenda.map((a) => (
            <div key={a.addendumNo} className="addendum">
              <div className="stamp" style={{ marginBottom: 6 }}>
                {t.addedOn(a.capturedAt ? t.formatDate(a.capturedAt) : t.later)}
              </div>
              {(() => {
                const body = display(a.body, tr, "addendum", a.id);
                return (
                  <>
                    <div className={body.translated ? "machine" : "testimony"}>{body.text}</div>
                    {body.translated && (
                      <span className="stamp stamp-machine translated-note">
                        {t.machineTranslation}
                      </span>
                    )}
                  </>
                );
              })()}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 22 }}>
        <AddAddendum dreamId={dream.id} lang={view.lang} />
      </div>

      <h2>{t.restatement}</h2>
      {restatement && restatement.accepted ? (
        <>
          <div className="derived">
            <div className="stamp stamp-machine" style={{ marginBottom: 8 }}>
              {restatement.model} · {restatement.promptVersion} · accepted
            </div>
            <div className="machine" style={{ whiteSpace: "pre-wrap" }}>
              {display(restatement.latestProposal ?? "", tr, "restatement", restatement.id).text}
            </div>
          </div>

          {restatement.turns.length > 0 && (
            <details style={{ marginTop: 18 }}>
              <summary className="stamp">{t.loopTurns(restatement.turns.length)}</summary>
              <div className="stack" style={{ marginTop: 14 }}>
                {restatement.turns.map((turn) => (
                  <div key={turn.turnNo}>
                    <div
                      className={turn.role === "objection" ? "stamp" : "stamp stamp-machine"}
                      style={{ marginBottom: 6 }}
                    >
                      {turn.turnNo} · {turn.role === "objection" ? t.you : t.machine}
                    </div>
                    <div className={turn.role === "objection" ? "turn-said" : "turn-machine"}>
                      {turn.body}
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
            {t.openNotAccepted}
          </p>
          <RestatementLoop
            restatementId={restatement.id}
            dreamId={dream.id}
            initialProposal={restatement.latestProposal}
            lang={view.lang}
          />
        </>
      ) : (
        <p className="machine">{t.noRestatement}</p>
      )}

      <h2>{t.analyses}</h2>
      <p className="machine" style={{ marginTop: 0 }}>
        {t.analysesNote}
      </p>
      <DreamActions dreamId={dream.id} lang={view.lang} />
      <div className="stack" style={{ marginTop: 18 }}>
        {analyses.length === 0 ? (
          <p className="stamp stamp-flag">{t.notAnalyzed}</p>
        ) : (
          analyses.map((a) => {
            // Resolved here, not stored: the two strings this needs are both
            // already on file, so every analysis ever written is clickable
            // without a re-run, and a better matcher improves the old ones too.
            const shown = display(a.body, tr, "analysis", a.id);
            const segments = shown.translated
              ? segmentTranslated(shown.text, a.body ?? "", dream.rawTranscript)
              : segmentByQuotations(shown.text, dream.rawTranscript);
            return (
              <div key={a.id} className="derived">
                <div className="stamp stamp-machine" style={{ marginBottom: 8 }}>
                  {t.formatDate(a.createdAt)} · {a.model} · {a.promptVersion}
                  {a.blind ? " · blind" : ""}
                </div>
                <AnalysisBody
                  segments={segments}
                  dreamId={dream.id}
                  dreamNumber={dream.sequenceNo}
                  dreamtOn={dream.dreamtOn}
                />
              </div>
            );
          })
        )}
      </div>

      <h2>{t.export}</h2>
      <ExportButton text={exportText} label={t.copyAsText} copiedLabel={t.copied} />

      <h2>{t.deleteHeading}</h2>
      <p className="machine" style={{ marginTop: 0 }}>
        {t.deleteNote}
      </p>
      <DeleteDream dreamId={dream.id} sequenceNo={dream.sequenceNo} lang={view.lang} />
    </main>
    </CitationProvider>
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
