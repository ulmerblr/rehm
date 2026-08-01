"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Two-step, deliberate delete. The first click only reveals the confirmation —
// destroying a dream is permanent and takes its restatement, analyses, and any
// trend tags with it, so it should never be a single mis-tap.
export default function DeleteDream({
  dreamId,
  sequenceNo,
}: {
  dreamId: string;
  sequenceNo: number;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function del() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/dreams/${dreamId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || `failed (${res.status})`);
      // Gone — leave the (now-deleted) detail page for the dream list.
      router.replace("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button className="btn btn-danger" onClick={() => setConfirming(true)}>
        Delete this dream
      </button>
    );
  }

  return (
    <div className="card" style={{ borderColor: "var(--danger)" }}>
      <p style={{ marginTop: 0 }}>
        Permanently delete <strong>Dream {sequenceNo}</strong>? This destroys its
        raw transcript, its restatement and the whole loop, every analysis, and
        any trend tags that cite it. This cannot be undone.
      </p>
      <div className="row" style={{ gap: 10 }}>
        <button className="btn btn-danger" onClick={del} disabled={busy}>
          {busy ? "Deleting…" : "Yes, delete permanently"}
        </button>
        <button
          className="btn"
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
          disabled={busy}
        >
          Cancel
        </button>
      </div>
      {error && <p className="notice" style={{ marginBottom: 0 }}>{error}</p>}
    </div>
  );
}
