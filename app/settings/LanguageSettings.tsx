"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LANG_ENDONYM, LANGS, formatUsd, type Lang } from "@/lib/lang";
import { dict } from "@/lib/i18n";

type Pending = { items: number; usd: number };

/**
 * The account's language, and whether it prepares both.
 *
 * Two separate decisions, deliberately not collapsed into one control: your
 * language governs what gets written, and dual mode governs whether a second
 * copy is kept for someone else to read. Conflating them would mean switching
 * to Spanish silently started billing for English translations.
 */
export default function LanguageSettings({
  initial,
  viewLang,
}: {
  initial: { language: Lang; dual: boolean; pending: Pending };
  viewLang: Lang;
}) {
  const router = useRouter();
  const t = dict(viewLang);

  const [language, setLanguage] = useState<Lang>(initial.language);
  const [dual, setDual] = useState(initial.dual);
  const [pending, setPending] = useState<Pending>(initial.pending);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [finished, setFinished] = useState<{ failed: number } | null>(null);
  // Set when a run stops before finishing. Distinct from `error`: the work so
  // far is safe and pressing continue picks it straight back up.
  const [interrupted, setInterrupted] = useState<number | null>(null);
  // Guards against two loops running at once — an auto-resume firing while a
  // manual one is still going would double the requests, not the progress.
  const runningRef = useRef(false);

  async function save(next: { language?: Lang; dual?: boolean }) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/lang/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || `failed (${res.status})`);
      setLanguage(data.language);
      setDual(Boolean(data.dual));
      setPending(data.pending ?? { items: 0, usd: 0 });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  /** How much is genuinely left, asked of the server rather than assumed. */
  const refreshPending = useCallback(async (): Promise<number> => {
    try {
      const res = await fetch("/api/lang/settings");
      const data = await res.json().catch(() => ({}));
      const next = data?.pending ?? { items: 0, usd: 0 };
      setPending(next);
      return Number(next.items ?? 0);
    } catch {
      return -1; // unknown; the caller shows a generic message
    }
  }, []);

  /**
   * One step, retried through transient network failures.
   *
   * A backgrounded tab has its in-flight request killed by the OS, which
   * surfaces as a bare "Load failed" — recoverable, and not worth ending a
   * two-minute run over. A step that has genuinely failed server-side comes
   * back as an HTTP error instead, and that is thrown immediately.
   */
  async function step(jobId: string): Promise<Record<string, unknown>> {
    let lastNetworkError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`/api/lang/backfill/${jobId}/step`, { method: "POST" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || data?.error || `failed (${res.status})`);
        return data;
      } catch (e) {
        // A thrown Error with our own message is a real server failure.
        if (e instanceof Error && !/^(Load failed|Failed to fetch|NetworkError)/i.test(e.message)) {
          throw e;
        }
        lastNetworkError = e;
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
    throw lastNetworkError instanceof Error ? lastNetworkError : new Error("network");
  }

  // Drive the backfill a chunk per request. Each step finishes well inside the
  // server's time limit, so the corpus can be any size; an interrupted run
  // resumes where it stopped instead of starting over or paying twice.
  const runBackfill = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setError(null);
    setFinished(null);
    setInterrupted(null);
    setBusy(true);
    try {
      const open = await fetch("/api/lang/backfill", { method: "POST" });
      const started = await open.json().catch(() => ({}));
      if (!open.ok) throw new Error(started?.message || `failed (${open.status})`);
      if (!started.jobId) {
        setFinished({ failed: 0 });
        setPending({ items: 0, usd: 0 });
        return;
      }

      setProgress({ done: 0, total: started.items ?? pending.items });

      for (let i = 0; i < 2000; i++) {
        const data = await step(String(started.jobId));
        if (typeof data.completed === "number" && typeof data.total === "number") {
          setProgress({ done: data.completed, total: data.total });
        }
        if (data.done) {
          setFinished({ failed: Number(data.failed ?? 0) });
          setPending({ items: 0, usd: 0 });
          break;
        }
      }
      router.refresh();
    } catch (e) {
      // Whatever went wrong, the translations already written are committed.
      // Say what is left rather than reporting the raw failure as a dead end.
      const left = await refreshPending();
      if (left > 0) setInterrupted(left);
      else if (left === 0) setFinished({ failed: 0 });
      else setError(e instanceof Error ? e.message : "failed");
    } finally {
      runningRef.current = false;
      setBusy(false);
      setProgress(null);
    }
  }, [pending.items, refreshPending, router]);

  // Coming back to the tab after the OS paused it is the single most likely way
  // a run stops, so returning to it is what restarts the run.
  useEffect(() => {
    if (interrupted === null) return;
    const onVisible = () => {
      if (document.visibilityState === "visible" && !runningRef.current) {
        void runBackfill();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [interrupted, runBackfill]);

  return (
    <div>
      <p className="machine" style={{ marginTop: 0 }}>
        {t.languageSectionNote}
      </p>

      <div className="stamp" style={{ marginTop: 18 }}>
        {t.yourLanguage}
      </div>
      <div className="row" style={{ gap: 10, marginTop: 8 }}>
        {LANGS.map((l) => (
          <button
            key={l}
            className={l === language ? "btn btn-sm btn-primary" : "btn btn-sm"}
            disabled={busy}
            onClick={() => save({ language: l })}
          >
            {LANG_ENDONYM[l]}
          </button>
        ))}
      </div>
      <p className="machine" style={{ marginTop: 10 }}>
        {t.yourLanguageNote}
      </p>

      <div className="stamp" style={{ marginTop: 24 }}>
        {dual ? t.dualLanguage : t.singleLanguage}
      </div>
      <p className="machine" style={{ marginTop: 8 }}>
        {dual ? t.dualLanguageNote : t.singleLanguageNote}
      </p>

      {!dual && (
        <button className="btn" disabled={busy} onClick={() => save({ dual: true })}>
          {t.turnOnDual}
        </button>
      )}

      {dual && (
        <>
          {interrupted !== null && !progress && (
            <>
              <p className="notice" style={{ marginTop: 12 }}>
                {t.backfillInterrupted(interrupted)}
              </p>
              <button className="btn btn-primary" disabled={busy} onClick={runBackfill}>
                {t.backfillContinue}
              </button>
            </>
          )}

          {pending.items > 0 && interrupted === null && !progress && !finished && (
            <>
              <p className="notice" style={{ marginTop: 12 }}>
                {t.backfillPrompt(pending.items, formatUsd(pending.usd))}
              </p>
              <button className="btn btn-primary" disabled={busy} onClick={runBackfill}>
                {t.backfillRun}
              </button>
            </>
          )}

          {progress && (
            <>
              <p className="stamp stamp-machine" style={{ marginTop: 12 }}>
                {t.backfillRunning(progress.done, progress.total)}
              </p>
              <p className="machine" style={{ marginTop: 6 }}>
                {t.backfillKeepOpen}
              </p>
            </>
          )}

          {finished && (
            <p className="machine" style={{ marginTop: 12 }}>
              {finished.failed > 0 ? t.backfillFailed(finished.failed) : t.backfillDone}
            </p>
          )}

          {pending.items === 0 && interrupted === null && !progress && !finished && (
            <p className="machine" style={{ marginTop: 12 }}>
              {t.backfillDone}
            </p>
          )}

          <div style={{ marginTop: 18 }}>
            <button className="linklike stamp" disabled={busy} onClick={() => save({ dual: false })}>
              {t.turnOffDual}
            </button>
            <p className="machine" style={{ marginTop: 6 }}>
              {t.translationsKept}
            </p>
          </div>
        </>
      )}

      {error && (
        <p className="notice" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}
    </div>
  );
}
