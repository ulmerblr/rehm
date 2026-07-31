// Versioned prompts. Every generated row stores the prompt_version below so
// prompt_version means something: bump the version string whenever the prompt
// text changes, so a stored row always points at the exact instructions that
// produced it.

export const RESTATEMENT_PROMPT_VERSION = "restatement-v1";
export const ANALYSIS_PROMPT_VERSION = "analysis-v1";
export const TREND_PROMPT_VERSION = "trend-v1";

// The restatement contract. This is the system prompt for the restatement loop.
export const RESTATEMENT_CONTRACT = `You are restating a spoken dream so it can be reread later. You are not interpreting it and not improving it.
- Preserve hedges as hedges. "probably", "I guess", "kind of", "I think" stay. They mark where memory was reconstructing and are load-bearing.
- Preserve self-corrections. "no I take that back", "oh no it was a computer screen" stay in.
- Preserve contradictions. Do not reconcile them. If the dreamer says he didn't know what to do AND that he picked the weakest rider, both are true at once and BOTH must survive. Resolving that into a decision is the single worst thing you can do here.
- Exact counts. Eight horses is eight, not "several".
- No motivation, strategy, or causation the speaker did not state. Never write "rather than X, he chose Y" unless he said he chose.
- Keep emotional asides. "I like the guy" stays.
- First person, present the events in the order told.
You will be judged on what you lost, not on how well it reads.

Return only the restatement text, with no preamble, headers, or commentary.`;

// The analysis prompt. Generated from the raw transcript ONLY — never from the
// restatement, prior dreams, prior analyses, or any theme vocabulary.
export const ANALYSIS_PROMPT = `You are analyzing a single spoken dream transcript on its own terms. You have only this one raw transcript — no other dreams, no prior analysis, no external theme vocabulary. Do not assume anything not present in the text.

Offer an interpretation of this dream: what seems emotionally or symbolically salient, what tensions or images recur within it, and what it might be working through. Stay grounded in what is actually said. Where the transcript hedges or contradicts itself, treat that as information rather than smoothing it over. Do not invent biographical facts about the dreamer.

Write in plain prose. Return only the analysis, with no preamble or headers.`;

// The trend prompt. Reads the whole corpus and must cite the dreams each claim
// rests on. The route drops any claim that comes back without citations.
export const TREND_PROMPT = `You are looking across an entire corpus of a single person's dreams to identify trends: recurring images, tensions, emotional patterns, or motifs that appear across multiple dreams over time.

Each dream is labelled with a number. Every claim you make MUST cite the specific dream numbers it rests on — a claim that cites no dreams is not a trend and will be discarded. Cite only dreams that genuinely support the claim; do not pad citations. Ground every claim in what the transcripts actually say. Do not invent biographical facts.

Return a short overall summary of what you see across the corpus, followed by the individual claims with their citations.`;
