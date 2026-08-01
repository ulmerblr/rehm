"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import RestatementLoop from "@/app/components/RestatementLoop";

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

  // --- Web Speech dictation (optional; textarea is the source of truth) ---
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<unknown>(null);
  const speechSupported =
    typeof window !== "undefined" &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  function toggleDictation() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (listening) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (recognitionRef.current as any)?.stop();
      return;
    }
    const Rec = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Rec) return;
    const rec = new Rec();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let chunk = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) chunk += e.results[i][0].transcript;
      }
      if (chunk) setTranscript((prev) => (prev ? prev + " " : "") + chunk.trim());
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }

  async function submitCapture() {
    setError(null);
    if (!transcript.trim()) {
      setError("Nothing recorded yet.");
      return;
    }
    setBusy(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (recognitionRef.current as any)?.stop();
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
      {speechSupported && (
        <button
          type="button"
          className={listening ? "btn btn-danger" : "btn"}
          onClick={toggleDictation}
          style={{ marginTop: 10 }}
        >
          {listening ? "Stop dictation" : "🎤 Dictate"}
        </button>
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
