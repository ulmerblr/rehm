"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { contextWindow } from "@/lib/spans";
import { dict } from "@/lib/i18n";
import type { Lang } from "@/lib/lang";

/**
 * Tapping a quoted passage opens it where it was said.
 *
 * A modal, deliberately — not a page. The whole value of a citation is checking
 * it without losing the argument you were reading, and any navigation costs you
 * the scroll position and the thread. Nothing here changes the URL.
 *
 * Built on <dialog> + showModal(), which gives focus trapping, Escape, and the
 * top layer from the platform rather than from three hundred lines of my own
 * that would be subtly wrong on a phone.
 */

export type CiteTarget = {
  dreamId: string;
  /** Offsets into the raw transcript. */
  start: number;
  end: number;
  /** Known up front on a trend page; looked up otherwise. */
  dreamNumber?: number;
  dreamtOn?: string | null;
};

type Ctx = { open: (t: CiteTarget) => void };
const CitationCtx = createContext<Ctx | null>(null);

export function useCitation(): Ctx {
  return useContext(CitationCtx) ?? { open: () => {} };
}

type Fetched = { sequenceNo: number; dreamtOn: string | null; text: string };

export function CitationProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const t = dict(lang);
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Transcripts are immutable, so anything fetched once is good forever.
  const cache = useRef(new Map<string, Fetched>());
  // Whatever was focused when the modal opened, to hand focus back to on close.
  const opener = useRef<HTMLElement | null>(null);

  const [target, setTarget] = useState<CiteTarget | null>(null);
  const [dream, setDream] = useState<Fetched | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [whole, setWhole] = useState(false);

  const open = useCallback((next: CiteTarget) => {
    opener.current = document.activeElement as HTMLElement | null;
    setTarget(next);
    setWhole(false);
    setDream(null);
    setState("loading");
  }, []);

  const close = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  // Load the transcript for whatever was tapped.
  useEffect(() => {
    if (!target) return;
    const hit = cache.current.get(target.dreamId);
    if (hit) {
      setDream(hit);
      setState("idle");
      return;
    }
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/dreams/${target.dreamId}/transcript`);
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as Fetched;
        cache.current.set(target.dreamId, data);
        if (!alive) return;
        setDream(data);
        setState("idle");
      } catch {
        if (alive) setState("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [target]);

  // Show and hide the real dialog alongside the target state.
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (target && !el.open) el.showModal();
    if (!target && el.open) el.close();
  }, [target]);

  // The page behind must not scroll under the modal on a phone.
  useEffect(() => {
    if (!target) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [target]);

  // One close path for every way out — Escape, the control, the backdrop — so
  // focus is restored exactly once and from one place.
  const onClose = useCallback(() => {
    setTarget(null);
    setDream(null);
    setState("idle");
    opener.current?.focus?.();
    opener.current = null;
  }, []);

  const passage = dream && target ? slice(dream.text, target, whole) : null;

  return (
    <CitationCtx.Provider value={{ open }}>
      {children}
      <dialog
        ref={dialogRef}
        className="cite-modal"
        onClose={onClose}
        onClick={(e) => {
          // showModal() makes the backdrop part of the dialog's own box, so a
          // click outside the panel lands on the dialog itself.
          if (e.target === dialogRef.current) close();
        }}
        aria-label={t.inTheTranscript}
      >
        <div className="cite-panel">
          <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
            <span className="stamp">
              {dream
                ? `${String(target?.dreamNumber ?? dream.sequenceNo).padStart(2, "0")}${
                    dream.dreamtOn ? ` · ${t.formatDate(dream.dreamtOn)}` : ""
                  }`
                : t.inTheTranscript}
            </span>
            <button className="linklike stamp" onClick={close} aria-label={t.close}>
              {t.close}
            </button>
          </div>

          <div className="cite-body">
            {state === "loading" && <p className="machine">{t.loading}</p>}
            {state === "error" && <p className="notice">{t.couldNotLoadTranscript}</p>}
            {passage && (
              <p className="testimony cite-passage">
                {passage.before}
                <mark className="cite-mark">{passage.quote}</mark>
                {passage.after}
              </p>
            )}
          </div>

          {passage && (
            <div className="row" style={{ gap: 14, marginTop: 4 }}>
              {passage.clipped && (
                <button className="linklike stamp" onClick={() => setWhole((w) => !w)}>
                  {whole ? t.showLessContext : t.showWholeTranscript}
                </button>
              )}
              <span className="row-end">
                {target && (
                  <Link href={`/dreams/${target.dreamId}`} className="stamp">
                    {t.openTheDream} →
                  </Link>
                )}
              </span>
            </div>
          )}
        </div>
      </dialog>
    </CitationCtx.Provider>
  );
}

/** Cut the transcript down to the passage and its surroundings. */
function slice(text: string, target: CiteTarget, whole: boolean) {
  const start = Math.max(0, Math.min(target.start, text.length));
  const end = Math.max(start, Math.min(target.end, text.length));
  const w = whole ? { start: 0, end: text.length } : contextWindow(text, start, end);
  return {
    before: text.slice(w.start, start),
    quote: text.slice(start, end),
    after: text.slice(end, w.end),
    clipped: w.start > 0 || w.end < text.length,
  };
}

/**
 * A quoted passage that can be tapped.
 *
 * Rendered in the dreamer's voice — warm, serif — because that is what it is:
 * his own words sitting inside machine-written prose. The provenance rule the
 * rest of the app follows does not stop applying because the words are nested.
 */
export function Cite({
  target,
  children,
  className,
}: {
  target: CiteTarget;
  children: ReactNode;
  className?: string;
}) {
  const { open } = useCitation();
  return (
    <button
      type="button"
      className={className ? `cite-quote ${className}` : "cite-quote"}
      onClick={() => open(target)}
    >
      {children}
    </button>
  );
}
