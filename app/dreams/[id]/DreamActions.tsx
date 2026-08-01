"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { dict } from "@/lib/i18n";
import type { Lang } from "@/lib/lang";

export default function DreamActions({ dreamId, lang }: { dreamId: string; lang: Lang }) {
  const router = useRouter();
  const t = dict(lang);
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
        {busy ? t.analyzing : t.runAnalysis}
      </button>
      {error && <p className="notice" style={{ marginTop: 10 }}>{error}</p>}
    </div>
  );
}
