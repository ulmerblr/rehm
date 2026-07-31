"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Phase = "capture" | "loop";

export default function RecordFlow({
  sequenceNo,
  today,
}: {
  sequenceNo: number;
  today: string;
}) {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("capture");
  const [transcript, setTranscript] = useState("");
  const [dreamtOn, setDreamtOn] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [restatementId, setRestatementId] = useState<string | null>(null);
  const [dreamId, setDreamId] = useState<string | null>(null);
  const [proposal, setProposal] = useState("");
  const [disagreeing, setDisagreeing] = useState(false);
  const [objection, setObjection] = useState("");

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
      if (chunk) {
        setTranscript((prev) => (prev ? prev + " " : "") + chunk.trim());
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }

  async function post(url: string, body?: unknown) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `request failed (${res.status})`);
    return data;
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
      const created = await post("/api/dreams", {
        rawTranscript: transcript,
        dreamtOn,
      });
      setDreamId(created.dreamId);
      setRestatementId(created.restatementId);
      const first = await post(`/api/restatements/${created.restatementId}/propose`);
      setProposal(first.proposal);
      setPhase("loop");
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  async function agree() {
    if (!restatementId || !dreamId) return;
    setError(null);
    setBusy(true);
    try {
      await post(`/api/restatements/${restatementId}/accept`);
      router.push(`/dreams/${dreamId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
      setBusy(false);
    }
  }

  async function submitObjection() {
    if (!restatementId) return;
    setError(null);
    if (!objection.trim()) {
      setError("Say what it got wrong.");
      return;
    }
    setBusy(true);
    try {
      const next = await post(`/api/restatements/${restatementId}/propose`, {
        objection,
      });
      setProposal(next.proposal);
      setObjection("");
      setDisagreeing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  if (phase === "capture") {
    return (
      <div>
        <p className="seq" style={{ marginTop: 14 }}>
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
          <button
            className="btn btn-primary btn-block btn-lg"
            onClick={submitCapture}
            disabled={busy}
          >
            {busy ? "Working…" : "Submit — get a restatement"}
          </button>
        </div>
      </div>
    );
  }

  // phase === "loop"
  return (
    <div>
      <h2>Does this restate it?</h2>
      <div className="verbatim">{busy && !disagreeing ? "Thinking…" : proposal}</div>

      {error && <p className="notice" style={{ marginTop: 14 }}>{error}</p>}

      {!disagreeing ? (
        <div className="row" style={{ marginTop: 18 }}>
          <button
            className="btn btn-primary btn-lg"
            style={{ flex: 1 }}
            onClick={agree}
            disabled={busy}
          >
            Agree
          </button>
          <button
            className="btn btn-lg"
            style={{ flex: 1 }}
            onClick={() => setDisagreeing(true)}
            disabled={busy}
          >
            Disagree
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 16 }}>
          <label htmlFor="objection">What did it get wrong?</label>
          <textarea
            id="objection"
            value={objection}
            onChange={(e) => setObjection(e.target.value)}
            placeholder="It said… but actually…"
            style={{ minHeight: 140 }}
          />
          <div className="row" style={{ marginTop: 12 }}>
            <button
              className="btn btn-primary btn-lg"
              style={{ flex: 1 }}
              onClick={submitObjection}
              disabled={busy}
            >
              {busy ? "Thinking…" : "Send — try again"}
            </button>
            <button
              className="btn"
              onClick={() => {
                setDisagreeing(false);
                setObjection("");
                setError(null);
              }}
              disabled={busy}
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
