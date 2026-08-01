// Versioned prompts. Every generated row stores the prompt_version below so
// prompt_version means something: bump the version string whenever the prompt
// text changes, so a stored row always points at the exact instructions that
// produced it.

export const RESTATEMENT_PROMPT_VERSION = "restatement-v1";
export const ANALYSIS_PROMPT_VERSION = "analysis-v1";
// v4 adds structured evidence: the batch pass lifts verbatim quotes while it
// has the transcripts open, and synthesis attaches them to claims by id. The
// prose the model writes is unchanged — v3's claims read well and the request
// was explicitly to keep writing them the same way. What changed is that the
// evidence now also comes back as data, which is what makes it clickable.
//
// (The spec said "bump to trend-v2"; v2 and v3 already shipped, so this is v4.
// v1–v3 runs stay listed and readable with their own stamp, as always.)
export const TREND_PROMPT_VERSION = "trend-v4";

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

// A trend pass runs in two stages so it fits inside a serverless request and
// scales to any corpus size: many BATCH steps read a few dreams each, then one
// SYNTHESIS step turns their observations into the final claims.
//
// The batch step deliberately does NOT conclude anything — concluding from a
// slice of the corpus is exactly the error the whole design is trying to avoid.
export const TREND_BATCH_PROMPT = `You are reading part of a larger set of one person's dreams. This is a first pass over one batch, not the whole set — do NOT draw conclusions or announce trends. Another step will do that once every batch has been read.

Return two things.

1. observations — what you notice in this batch only: recurring or striking images, places, people, actions; emotional tones; tensions or contradictions; anything a reader looking for patterns across the whole set would want flagged. Each dream is labelled with a number, and every observation MUST cite the dream numbers it comes from. Stay strictly grounded in what the transcripts say — do not interpret, do not speculate about the dreamer's life, and do not invent biographical facts. Note things that occur only once if they are distinctive; a single vivid detail may turn out to matter later.

2. quotes — the dreamer's own words, copied out, for a later step to use as evidence. This is transcription, not writing. Copy CHARACTER FOR CHARACTER from the spoken transcript of a dream. Never quote from a block marked [Remembered afterwards] or [Earlier interpretation] — the first is not part of the transcript and the second is not the dreamer speaking at all.
- No paraphrase. No cleanup. No ellipsis. No fixed grammar or punctuation.
- Filler stays. If the words are "um, I guess probably", that is the quote.
- Self-corrections stay. If he says "a truck, no a boat", that is the quote.
- Roughly 5 to 25 words each. A fragment is fine if the fragment is what is striking.
- Give each quote the dream number it came from.
- Lift generously: 5 to 15 per dream, covering anything a later step might want to point at — the vivid images, the emotional beats, the contradictions, the odd details. A later step can only cite what you copy here, so a passage you skip cannot be used as evidence at all.
- Do not copy the same passage twice.
If a dream in this batch is too short or too flat to quote from, return no quotes for it rather than inventing one.`;

export const TREND_SYNTHESIS_PROMPT = `You are completing a trend analysis over one person's dreams. The dreams were read in batches, and you are given the observations recorded from every batch, each citing the dream numbers it came from. You are also given a numbered list of QUOTES — the dreamer's own words, copied out of the transcripts during that reading. Work only from these observations, their citations, and the quotes.

Return three things:

1. summary — a short opening orientation: what this set of dreams is like to read.

2. claims — the trends themselves. A trend is something that holds across the set, so prefer claims supported by more than one dream, and merge observations from different batches that are really the same pattern. Every claim MUST cite the specific dream numbers it rests on — a claim citing no dreams is not a trend and will be discarded. Cite only dreams that genuinely support the claim; do not pad citations. Never cite a dream number that does not appear in the observations you were given.

   Each claim also carries evidence: the ids of the quotes that show it, from the list you were given. Rules for evidence:
   - Reference quotes by their id only. Do not retype, trim, or adjust the text of a quote; you cannot introduce a quote that is not in the list.
   - At least one quote for every dream number the claim cites. If you cannot find a quote in the list from a dream, do not cite that dream on that claim.
   - More than one quote from a dream is fine where more than one passage shows it.
   - Pick the quote that most directly shows the claim, not the most quotable line.
   - A claim you cannot support with any quote at all is not a claim. Leave it out.

   Write the claim itself exactly as you would have without any of this. The prose may still paraphrase and range across dreams as prose should; the evidence sits alongside it, not inside it.

3. closing — a genuine conclusion, and the most important part. Do NOT restate the claims or list them again. Say what they add up to when taken together: the through-line running under them, what appears to be at stake for this dreamer, and where the tension sits. Then state plainly what the evidence does NOT yet support — the reading you considered and rejected, or what you would need more dreams to tell. End with something that lands: a claim about the whole, not a hedge. If this set is too small or too varied to support a through-line, say exactly that instead of manufacturing one.

Do not end the closing on a list. It should read as a final paragraph a person can sit with.`;

// The single-pass trend prompt, kept for reference. Reads the whole corpus and
// must cite the dreams each claim rests on; claims without citations are
// dropped.
export const TREND_PROMPT = `You are looking across a set of one person's dreams to identify trends: recurring images, tensions, emotional patterns, or motifs that appear across multiple dreams over time.

Each dream is labelled with a number. Every claim you make MUST cite the specific dream numbers it rests on — a claim that cites no dreams is not a trend and will be discarded. Cite only dreams that genuinely support the claim; do not pad citations. Ground every claim in what the transcripts actually say. Do not invent biographical facts.

Return three things:

1. summary — a short opening orientation: what this set of dreams is like to read.

2. claims — the individual trends, each citing the dreams it rests on.

3. closing — a genuine conclusion, and the most important part. Do NOT restate the claims or list them again. Say what they add up to when taken together: the through-line running under them, what appears to be at stake for this dreamer, and where the tension sits. Then state plainly what the evidence does NOT yet support — the reading you considered and rejected, or what you would need more dreams to tell. End with something that lands: a claim about the whole, not a hedge. If this set is too small or too varied to support a through-line, say exactly that instead of manufacturing one.

Do not end the closing on a list. It should read as a final paragraph a person can sit with.`;

export const TRANSLATION_PROMPT_VERSION = "translation-v1";

// Translation is for READING, never for the pipeline. Nothing downstream is
// allowed to consume a translation, so this prompt optimizes for one thing:
// carrying the original across without gaining or losing anything on the way.
//
// The hardest instruction here is the one about hedges and contradictions. A
// dream transcript is full of "I think", "no wait", "I guess" — a translator's
// instinct is to tidy those, and tidying them destroys exactly what the
// restatement contract works to preserve. Same rule, different direction.
export const TRANSLATION_SAID = `You are translating the transcript of a spoken dream. It was said aloud, from memory, and is the primary record — translate it, do not repair it.

- Keep hedges as hedges. "I think", "I guess", "kind of", "maybe" have direct equivalents. Use them.
- Keep self-corrections and false starts. If the speaker doubles back, so does the translation.
- Keep contradictions. Do not reconcile them.
- Keep exact counts and concrete nouns exactly as given.
- Keep the register. Casual speech stays casual; do not raise it into written prose.
- Do not add clarifying words the speaker did not say. Do not explain images.
- If something is ambiguous in the original, leave it ambiguous.

Return only the translated text. No preamble, no notes, no bracketed comments.`;

export const TRANSLATION_MACHINE = `You are translating text this application generated about someone's dreams — an analysis, a restatement, a title, or a passage about trends across many dreams.

- Translate faithfully and completely. Do not summarize, expand, or add interpretation of your own.
- Keep the tone: plain, direct, unsentimental. Do not make it warmer or more literary than it is.
- Preserve paragraph breaks exactly.
- Where the original hedges about what the evidence supports, keep the hedge at the same strength.
- Keep any dream numbers, dates, and counts exactly as written.

Return only the translated text. No preamble, no notes, no bracketed comments.`;

// Titles carry an extra constraint: they have to fit the same one line.
export const TRANSLATION_TITLE = `Translate this short dream title. Keep it to a few words and under 30 characters if you can. Be concrete and literal. Capitalize The First Letter Of Every Significant Word. No quotation marks, no ending punctuation.

Reply with the translated title only.`;
