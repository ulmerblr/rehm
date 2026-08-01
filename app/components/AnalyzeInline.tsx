"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearPending, isPending, markPending } from "@/lib/pending";
import { dict } from "@/lib/i18n";
import type { Lang } from "@/lib/lang";

// Analysis state as a mono stamp, not a pill. Unresolved uses --flag, which is
// reserved for exactly that meaning; a finished analysis needs no colour at all
// — its absence of a flag is the signal.
//
// A run started here keeps going server-side even if you navigate away, so the
// running state is persisted rather than held in this component. Coming back
// mid-run shows "analyzing" and polls, instead of offering the action again and
// quietly billing a second run.
export default function AnalyzeInline({
  dreamId,
  count,
  lang,
}: {
  dreamId: string;
  count: number;
  lang: Lang;
}) {
  const router = useRouter();
  const t = dict(lang);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (count > 0) {
      clearPending("analyze", dreamId);
      setBusy(false);
      return;
    }
    if (!isPending("analyze", dreamId)) return;

    setBusy(true);
    const poll = setInterval(() => router.refresh(), 4000);
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
    return (
      <span className="stamp stamp-machine">{t.analyzedTimes(count)}</span>
    );
  }

  if (busy) {
    return <span className="stamp">{t.analyzing}</span>;
  }

  if (error) {
    return (
      <span className="stamp stamp-flag" title={error}>
        {t.failedRetry} —{" "}
        <button className="linklike" onClick={run}>
          {t.retry}
        </button>
      </span>
    );
  }

  return (
    <span className="stamp stamp-flag">
      {t.notAnalyzed} —{" "}
      <button className="linklike" onClick={run}>
        {t.analyze.toLowerCase()}
      </button>
    </span>
  );
}
