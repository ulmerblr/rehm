"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Compact analysis status for a dreams-list row: a small dot and a word, with a
// plain text action when there's nothing yet. Deliberately not a button — a row
// is for scanning, and a heavy control on every row drowns out the dream.
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

  async function run() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/dreams/${dreamId}/analyze`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || `failed (${res.status})`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  if (count > 0) {
    return (
      <span className="status status-ok">Analyzed{count > 1 ? ` ×${count}` : ""}</span>
    );
  }

  if (error) {
    return (
      <span className="status status-bad" title={error}>
        Failed —{" "}
        <button className="linklike" onClick={run} disabled={busy}>
          retry
        </button>
      </span>
    );
  }

  return (
    <span className="status status-warn">
      {busy ? (
        "Analyzing…"
      ) : (
        <>
          Not analyzed —{" "}
          <button className="linklike" onClick={run}>
            analyze
          </button>
        </>
      )}
    </span>
  );
}
