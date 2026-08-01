"use client";

import { useEffect, useRef, useState } from "react";
import { dict } from "@/lib/i18n";
import type { Lang } from "@/lib/lang";

/**
 * A citation whose claim text has ALREADY been through display().
 *
 * Deliberately not lib/queries' DreamCitation, and deliberately not called
 * `claim`. This component cannot resolve a translation — the map lives on the
 * server — so taking a row shape here would mean the field silently rendering
 * in English on a Spanish page, which is the exact bug the trend summary had.
 * The name is the contract: whatever is passed is what will be shown.
 */
export type ShownCitation = {
  start: number;
  end: number;
  quote: string;
  claims: Array<{ id: string; claimShown: string; runCreatedAt: string }>;
};

/**
 * The transcript, with the passages trend claims keep returning to marked.
 *
 * The mark is a rule in the left gutter, not a highlight: the transcript is the
 * document, and decorating the dreamer's words with the machine's interest in
 * them would invert whose page this is. You notice the marks when you look for
 * them and read past them when you don't.
 *
 * Tapping one says what was built on that passage. Nothing here links out to a
 * whole trend run first — the question a mark raises is "what did it conclude
 * from this", and the answer is the claim itself.
 */
export default function CitedTranscript({
  text,
  citations,
  lang,
  className,
}: {
  text: string;
  citations: ShownCitation[];
  lang: Lang;
  className?: string;
}) {
  const t = dict(lang);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState<ShownCitation | null>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const segments = cut(text, citations);

  return (
    <>
      <div className={className}>
        {segments.map((s, i) =>
          s.citation ? (
            <button
              key={i}
              type="button"
              className="cited-passage"
              onClick={(e) => {
                opener.current = e.currentTarget;
                setOpen(s.citation!);
              }}
              aria-label={t.claimsRestingHere(s.citation.claims.length)}
            >
              {s.text}
            </button>
          ) : (
            <span key={i}>{s.text}</span>
          )
        )}
      </div>

      <dialog
        ref={dialogRef}
        className="cite-modal"
        onClose={() => {
          setOpen(null);
          opener.current?.focus?.();
          opener.current = null;
        }}
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
        aria-label={t.builtOnThis}
      >
        <div className="cite-panel">
          <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
            <span className="stamp">{t.builtOnThis}</span>
            <button
              className="linklike stamp"
              onClick={() => dialogRef.current?.close()}
              aria-label={t.close}
            >
              {t.close}
            </button>
          </div>

          {open && (
            <div className="cite-body">
              <p className="testimony cite-passage">
                <mark className="cite-mark">{open.quote}</mark>
              </p>
              <div style={{ marginTop: 16 }}>
                {open.claims.map((c) => (
                  <div key={c.id} className="claim">
                    <div className="machine">{c.claimShown}</div>
                    <div className="stamp stamp-machine" style={{ marginTop: 6 }}>
                      {c.runCreatedAt ? t.formatDate(c.runCreatedAt) : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}

type Piece = { text: string; citation: ShownCitation | null };

/**
 * Cut the transcript at the cited ranges.
 *
 * Overlapping ranges are dropped rather than merged: two claims quoting
 * overlapping-but-different spans is rare, and the honest cheap answer is to
 * mark the first and leave the second unmarked, not to invent a combined range
 * that neither claim actually cited.
 */
function cut(text: string, citations: ShownCitation[]): Piece[] {
  const valid = citations
    .filter((c) => c.start >= 0 && c.end > c.start && c.end <= text.length)
    .sort((a, b) => a.start - b.start);

  const out: Piece[] = [];
  let cursor = 0;
  for (const c of valid) {
    if (c.start < cursor) continue; // overlaps something already marked
    if (c.start > cursor) out.push({ text: text.slice(cursor, c.start), citation: null });
    out.push({ text: text.slice(c.start, c.end), citation: c });
    cursor = c.end;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor), citation: null });
  return out.length > 0 ? out : [{ text, citation: null }];
}
