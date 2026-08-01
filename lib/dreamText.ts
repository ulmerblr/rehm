export type Addendum = {
  addendumNo: number;
  body: string;
  capturedAt: string;
};

// The full spoken record of a dream: the original transcript plus anything
// remembered afterwards, each addendum labelled with when it surfaced.
//
// The labelling is the point. A detail recalled days later is weaker evidence
// about the dream and stronger evidence about what stayed with the dreamer, and
// the model should be able to tell the difference rather than reading one flat
// block of text.
export function composeDreamText(rawTranscript: string, addenda: Addendum[]): string {
  if (addenda.length === 0) return rawTranscript;

  const parts = [rawTranscript];
  for (const a of addenda) {
    const when = a.capturedAt ? a.capturedAt.slice(0, 10) : "later";
    parts.push(`[Remembered afterwards, added ${when}]\n${a.body}`);
  }
  return parts.join("\n\n");
}
