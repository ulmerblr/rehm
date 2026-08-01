"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearPending, isPending, markPending } from "@/lib/pending";

// Compact analysis status for a dreams-list row: a small dot and a word, with a
// plain text action when there's nothing yet. Deliberately not a button — a row
// is for scanning, and a heavy control on every row drowns out the dream.
//
// A run started here keeps going server-side even if you navigate away, so the
// running state is persisted rather than held in this component. Coming back
// mid-run shows "Analyzing…" and polls until the result lands, instead of
// offering the action again and quietly billing a second run.
export default function AnalyzeInline({
  dreamId,
  count,
}: {
  dreamId: string;
  count: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Adopt a run that was started before this component mounted.
  useEffect(() => {
    if (count > 0) {
      clearPending("analyze", dreamId);
      setBusy(false);
      return;
    }
    if (!isPending("analyze", dreamId)) return;

    setBusy(true);
    const poll = setInterval(() => router.refresh(), 4000);
    // Stop waiting if the run never lands — the marker's own TTL is the backstop.
    const giveUp = setTimeout(() => {
      clearPending("analyze", dreamId);
      setBusy(false);
    }, 5 * 60 * 1000);
    return () => {
      clearInterval(poll);
      clearTimeout(giveUp);
    };
  }, [count, dreamId, router]);

  async function run() {
    setError(null);
    setBusy(true);
    markPending("analyze", dreamId);
    try {
      const res = await fetch(`/api/dreams/${dreamId}/analyze`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || `failed (${res.status})`);
      clearPending("analyze", dreamId);
      router.refresh();
    } catch (e) {
      clearPending("analyze", dreamId);
      setError(e instanceof Error ? e.message : "failed");
      setBusy(false);
    }
  }

  if (count > 0) {
    return <span className="status status-ok">Analyzed{count > 1 ? ` ×${count}` : ""}</span>;
  }

  if (busy) {
    return <span className="status status-warn">Analyzing…</span>;
  }

  if (error) {
    return (
      <span className="status status-bad" title={error}>
        Failed —{" "}
        <button className="linklike" onClick={run}>
          retry
        </button>
      </span>
    );
  }

  return (
    <span className="status status-warn">
      Not analyzed —{" "}
      <button className="linklike" onClick={run}>
        analyze
      </button>
    </span>
  );
}
