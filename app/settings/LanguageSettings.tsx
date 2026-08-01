"use client";

import { useState } from "react";
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

  // Drive the backfill a chunk per request. Each step finishes well inside the
  // server's time limit, so the corpus can be any size; an interrupted run
  // resumes where it stopped instead of starting over or paying twice.
  async function runBackfill() {
    setError(null);
    setFinished(null);
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
        const res = await fetch(`/api/lang/backfill/${started.jobId}/step`, { method: "POST" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || data?.error || `failed (${res.status})`);
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
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

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
          {pending.items > 0 && !progress && !finished && (
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
            <p className="stamp stamp-machine" style={{ marginTop: 12 }}>
              {t.backfillRunning(progress.done, progress.total)}
            </p>
          )}

          {finished && (
            <p className="machine" style={{ marginTop: 12 }}>
              {finished.failed > 0 ? t.backfillFailed(finished.failed) : t.backfillDone}
            </p>
          )}

          {pending.items === 0 && !progress && !finished && (
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
