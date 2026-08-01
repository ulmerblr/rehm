"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import RestatementLoop from "@/app/components/RestatementLoop";
import { useDictation } from "@/lib/useDictation";
import { dict } from "@/lib/i18n";
import type { Lang } from "@/lib/lang";

export default function RecordFlow({
  sequenceNo,
  today,
  speakLang,
  viewLang,
}: {
  sequenceNo: number;
  today: string;
  speakLang: Lang;
  viewLang: Lang;
}) {
  const t = dict(viewLang);
  const [transcript, setTranscript] = useState("");
  const [dreamtOn, setDreamtOn] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ids, setIds] = useState<{ dreamId: string; restatementId: string } | null>(null);

  // Dictation is a convenience on top of the textarea, never a replacement for
  // it: heard words land in the box, and the box stays the source of truth.
  const appendHeard = useCallback((heard: string) => {
    setTranscript((prev) => (prev ? prev + " " : "") + heard);
  }, []);
  const dictation = useDictation(appendHeard, speakLang);

  async function submitCapture() {
    setError(null);
    if (!transcript.trim()) {
      setError(t.nothingRecordedError);
      return;
    }
    setBusy(true);
    try {
      dictation.stop();
      const res = await fetch("/api/dreams", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rawTranscript: transcript, dreamtOn }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || `failed (${res.status})`);
      // Dream saved. Hand off to the loop (auto-starts the first proposal). If
      // the key fails there, the dream is already safe and resumable.
      setIds({ dreamId: data.dreamId, restatementId: data.restatementId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  if (ids) {
    return (
      <div>
        <h2>{t.doesThisRestateIt}</h2>
        <RestatementLoop
          restatementId={ids.restatementId}
          dreamId={ids.dreamId}
          initialProposal={null}
          autoStart
          lang={viewLang}
        />
        <p className="muted" style={{ marginTop: 16 }}>
          {t.savedAsDream(sequenceNo)}{" "}
          <Link href={`/dreams/${ids.dreamId}`}>{t.openTheDream}</Link> {t.toContinueLater}
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="stamp" style={{ marginTop: 14 }}>
        Dream {sequenceNo}
      </p>
      <label htmlFor="transcript">{t.talkThisIsStored}</label>
      <textarea
        id="transcript"
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        placeholder={t.speakOrType}
      />
      {dictation.state !== "unsupported" && (
        <div style={{ marginTop: 10 }}>
          <button
            type="button"
            className={dictation.state === "on" ? "btn btn-danger" : "btn"}
            onClick={dictation.toggle}
          >
            {dictation.state === "on"
              ? t.stopDictation
              : dictation.state === "starting"
                ? t.starting
                : `🎤 ${t.dictate}`}
          </button>

          {/* What it has heard but not yet committed — the proof it's live. */}
          {dictation.state === "on" && (
            <p className="stamp stamp-machine" style={{ marginTop: 10 }}>
              {dictation.interim ? `${t.hearing}: ${dictation.interim}` : t.listening}
            </p>
          )}

          {dictation.note && (
            <p className="notice" style={{ marginTop: 10 }}>
              {dictation.note}
            </p>
          )}
        </div>
      )}

      {/* Only mention the button if there is one — some browsers don't have it. */}
      {dictation.keyboardMic && (
        <p className="machine" style={{ marginTop: 10 }}>
          {dictation.state === "unsupported"
            ? t.keyboardMicOnly
            : t.twoWaysToTalk}
        </p>
      )}

      <label htmlFor="dreamt_on">{t.dateDreamt}</label>
      <input
        id="dreamt_on"
        type="date"
        value={dreamtOn}
        max={today}
        onChange={(e) => setDreamtOn(e.target.value)}
      />

      {error && <p className="notice" style={{ marginTop: 14 }}>{error}</p>}

      <div style={{ marginTop: 18 }}>
        <button className="btn btn-primary btn-block btn-lg" onClick={submitCapture} disabled={busy}>
          {busy ? t.saving : t.submitForRestatement}
        </button>
      </div>
    </div>
  );
}
