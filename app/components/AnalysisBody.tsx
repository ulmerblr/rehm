"use client";

import { Cite } from "./Citations";
import type { Segment } from "@/lib/spans";

/**
 * An analysis, with the passages it quotes made tappable.
 *
 * The segments are cut on the server — the resolver needs the transcript, and
 * the transcript should not be shipped to the browser to render an analysis.
 * What arrives here is prose runs and resolved quotations, already decided.
 *
 * Quotations that could not be found in the transcript never become segments,
 * so they render as part of an ordinary prose run: same text, same styling, no
 * marker of any kind. Nothing on this screen advertises a failed match.
 */
export default function AnalysisBody({
  segments,
  dreamId,
  dreamNumber,
  dreamtOn,
}: {
  segments: Segment[];
  dreamId: string;
  dreamNumber: number;
  dreamtOn: string | null;
}) {
  return (
    <div className="machine" style={{ whiteSpace: "pre-wrap" }}>
      {segments.map((s, i) =>
        s.kind === "text" ? (
          <span key={i}>{s.text}</span>
        ) : (
          <Cite
            key={i}
            target={{ dreamId, dreamNumber, dreamtOn, start: s.start, end: s.end }}
          >
            {s.text}
          </Cite>
        )
      )}
    </div>
  );
}
