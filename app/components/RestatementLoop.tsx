"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// The restatement loop. Resumable: given an open (unaccepted) restatement it
// shows the latest proposal (Agree / Disagree) or, if there is none yet, a
// button to generate the first one. Because capture already saved the raw
// transcript, a failed proposal here loses nothing — retry any time.
export default function RestatementLoop({
  restatementId,
  dreamId,
  initialProposal,
  autoStart = false,
}: {
  restatementId: string;
  dreamId: string;
  initialProposal: string | null;
  autoStart?: boolean;
}) {
  const router = useRouter();
  const [proposal, setProposal] = useState<string | null>(initialProposal);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disagreeing, setDisagreeing] = useState(false);
  const [objection, setObjection] = useState("");
  const startedRef = useRef(false);

  async function post(body?: unknown): Promise<{ proposal?: string }> {
    const res = await fetch(`/api/restatements/${restatementId}/propose`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || data?.error || `failed (${res.status})`);
    return data;
  }

  async function propose(body?: unknown) {
    setError(null);
    setBusy(true);
    try {
      const data = await post(body);
      if (data.proposal) setProposal(data.proposal);
      setDisagreeing(false);
      setObjection("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (autoStart && !startedRef.current && proposal === null) {
      startedRef.current = true;
      propose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function agree() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/restatements/${restatementId}/accept`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || `failed (${res.status})`);
      router.push(`/dreams/${dreamId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
      setBusy(false);
    }
  }

  if (proposal === null) {
    return (
      <div>
        {error && <p className="notice" style={{ marginBottom: 12 }}>{error}</p>}
        <button
          className="btn btn-primary btn-block btn-lg"
          onClick={() => propose()}
          disabled={busy}
        >
          {busy ? "Thinking…" : "Get a restatement"}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="turn-machine">{busy && !disagreeing ? "Thinking…" : proposal}</div>
      {error && <p className="notice" style={{ marginTop: 14 }}>{error}</p>}

      {!disagreeing ? (
        <div className="row" style={{ marginTop: 18 }}>
          <button className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={agree} disabled={busy}>
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
              onClick={() => {
                if (!objection.trim()) {
                  setError("Say what it got wrong.");
                  return;
                }
                propose({ objection });
              }}
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
