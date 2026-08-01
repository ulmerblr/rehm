"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import RestatementLoop from "@/app/components/RestatementLoop";
import { useDictation } from "@/lib/useDictation";

export default function RecordFlow({
  sequenceNo,
  today,
}: {
  sequenceNo: number;
  today: string;
}) {
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
  const dictation = useDictation(appendHeard);

  async function submitCapture() {
    setError(null);
    if (!transcript.trim()) {
      setError("Nothing recorded yet.");
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
        <h2>Does this restate it?</h2>
        <RestatementLoop
          restatementId={ids.restatementId}
          dreamId={ids.dreamId}
          initialProposal={null}
          autoStart
        />
        <p className="muted" style={{ marginTop: 16 }}>
          Saved as Dream {sequenceNo}. <Link href={`/dreams/${ids.dreamId}`}>Open the dream</Link>{" "}
          to continue later.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="stamp" style={{ marginTop: 14 }}>
        Dream {sequenceNo}
      </p>
      <label htmlFor="transcript">Talk. This is stored exactly as spoken.</label>
      <textarea
        id="transcript"
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        placeholder="Speak or type the dream…"
      />
      {dictation.state !== "unsupported" && (
        <div style={{ marginTop: 10 }}>
          <button
            type="button"
            className={dictation.state === "on" ? "btn btn-danger" : "btn"}
            onClick={dictation.toggle}
          >
            {dictation.state === "on"
              ? "Stop dictation"
              : dictation.state === "starting"
                ? "Starting…"
                : "🎤 Dictate"}
          </button>

          {/* What it has heard but not yet committed — the proof it's live. */}
          {dictation.state === "on" && (
            <p className="stamp stamp-machine" style={{ marginTop: 10 }}>
              {dictation.interim ? `hearing: ${dictation.interim}` : "listening…"}
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
            ? "To talk this in, tap into the box and use the microphone key on your keyboard."
            : "Two ways to talk this in: the button above, or tap into the box and use the microphone key on your keyboard. If one gives you trouble, try the other."}
        </p>
      )}

      <label htmlFor="dreamt_on">Date dreamt</label>
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
          {busy ? "Saving…" : "Submit — get a restatement"}
        </button>
      </div>
    </div>
  );
}
