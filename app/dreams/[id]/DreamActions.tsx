"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DreamActions({ dreamId }: { dreamId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runAnalysis() {
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

  return (
    <div>
      <button className="btn btn-primary" onClick={runAnalysis} disabled={busy}>
        {busy ? "Analyzing…" : "Run analysis"}
      </button>
      {error && <p className="notice" style={{ marginTop: 10 }}>{error}</p>}
    </div>
  );
}
