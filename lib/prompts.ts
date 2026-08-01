// Versioned prompts. Every generated row stores the prompt_version below so
// prompt_version means something: bump the version string whenever the prompt
// text changes, so a stored row always points at the exact instructions that
// produced it.

export const RESTATEMENT_PROMPT_VERSION = "restatement-v1";
export const ANALYSIS_PROMPT_VERSION = "analysis-v1";
export const TREND_PROMPT_VERSION = "trend-v2";

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

// The title prompt. A tiny label for the dream list — not analysis. Kept short
// and literal so it names the dream's central image, not an interpretation.
export const TITLE_PROMPT = `Write a very short title for this dream naming its central image, place, or event.

Rules:
- 2 to 5 words, and NO MORE THAN 30 CHARACTERS total. Shorter is better.
- Capitalize The First Letter Of Every Word.
- Be concrete and literal. Do not interpret or moralize.
- Do not use the words "dream" or "nightmare".
- No quotation marks and no ending punctuation.

Reply with the title only, nothing else.`;

// The trend prompt. Reads the whole corpus and must cite the dreams each claim
// rests on. The route drops any claim that comes back without citations.
export const TREND_PROMPT = `You are looking across a set of one person's dreams to identify trends: recurring images, tensions, emotional patterns, or motifs that appear across multiple dreams over time.

Each dream is labelled with a number. Every claim you make MUST cite the specific dream numbers it rests on — a claim that cites no dreams is not a trend and will be discarded. Cite only dreams that genuinely support the claim; do not pad citations. Ground every claim in what the transcripts actually say. Do not invent biographical facts.

Return three things:

1. summary — a short opening orientation: what this set of dreams is like to read.

2. claims — the individual trends, each citing the dreams it rests on.

3. closing — a genuine conclusion, and the most important part. Do NOT restate the claims or list them again. Say what they add up to when taken together: the through-line running under them, what appears to be at stake for this dreamer, and where the tension sits. Then state plainly what the evidence does NOT yet support — the reading you considered and rejected, or what you would need more dreams to tell. End with something that lands: a claim about the whole, not a hedge. If this set is too small or too varied to support a through-line, say exactly that instead of manufacturing one.

Do not end the closing on a list. It should read as a final paragraph a person can sit with.`;
