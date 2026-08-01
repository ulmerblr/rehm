"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Run an analysis straight from the dreams list, so a backlog of unanalyzed
// dreams can be worked through without opening each one. Costs a call on your
// key, so it is always an explicit tap — never automatic.
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
      <span className="tag tag-ok">
        Analyzed{count > 1 ? ` ×${count}` : ""}
      </span>
    );
  }

  return (
    <span className="row" style={{ gap: 8 }}>
      <span className="tag">Not analyzed</span>
      <button className="btn btn-sm" onClick={run} disabled={busy}>
        {busy ? "Analyzing…" : "Analyze"}
      </button>
      {error && (
        <span className="muted" style={{ fontSize: "0.8rem", color: "var(--danger)" }}>
          {error}
        </span>
      )}
    </span>
  );
}
