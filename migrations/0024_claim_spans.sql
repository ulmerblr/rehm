-- rehm — Milestone: evidence spans (clickable citations)
--
-- Apply after 0023 (auto-applied on deploy; no manual step).
--
-- Numbered 0024, not 0009 as the request said: 0009 shipped the usage ledger
-- long ago and a shipped migration is never edited. Everything else about the
-- spec is followed as written.
--
-- WHAT THIS IS FOR. A trend claim cites dreams 02 03 04 06 and mixes verbatim
-- quotes, quoted fragments and unquoted paraphrase in one sentence. Which
-- fragment belongs to which dream is knowable only while the transcripts are
-- being read, and that knowledge was previously thrown away. This table keeps
-- it: one row per piece of evidence, tying a claim to an exact passage of one
-- dream.
--
-- OFFSETS ARE THE SERVER'S, NEVER THE MODEL'S. char_start/char_end are found by
-- searching the raw transcript for the quote — exact first, then a normalized
-- pass that unifies curly punctuation, collapses whitespace and ignores case.
-- If neither finds it, the quote is stored with NULL offsets and match_kind
-- 'unresolved'. A position is never invented and a quote is never dropped: the
-- unresolved rows are the honest measure of whether the model is quoting or
-- inventing, which is the number worth watching.
--
-- ROOM FOR AUDIO, WITHOUT BUILDING IT. The record is deliberately anchored to
-- (dream_id, character range) rather than to anything about the prose it came
-- from. When audio arrives, audio_start_ms/audio_end_ms are two nullable
-- columns added beside those — no restructuring, no backfill of what is here.
-- They are NOT added now; unused columns are a promise the schema shouldn't
-- make on a feature's behalf.
--
-- THE WALL IS UNCHANGED. These rows are evidence pointers, read at render time
-- only. Nothing here feeds the restatement, the blind analysis, or any future
-- trend pass. No prompt reads this table.
--
-- ANALYSES ARE NOT HERE ON PURPOSE. An analysis quotes inside its own prose, so
-- its spans are recoverable from two strings we already store — the body and
-- the transcript — by the same resolver. They are computed at render and
-- memoized per request. That keeps every analysis already on file clickable
-- with no re-run and no backfill, and it means improving the matcher improves
-- old analyses too, which a stored table would have frozen.

SELECT current_user AS applying_role;

CREATE TABLE IF NOT EXISTS trend_claim_spans (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trend_claim_id uuid NOT NULL REFERENCES trend_claims (id) ON DELETE CASCADE,
  -- CASCADE: erasing a dream erases the pointers into it. The passage no
  -- longer exists, so neither should anything claiming to point at it. It also
  -- keeps the account-delete order working, which removes dreams before runs.
  dream_id       uuid NOT NULL REFERENCES dreams (id) ON DELETE CASCADE,
  quote          text NOT NULL,
  char_start     integer,
  char_end       integer,
  match_kind     text NOT NULL
                   CHECK (match_kind IN ('exact', 'normalized', 'unresolved')),
  created_at     timestamptz NOT NULL DEFAULT now(),

  -- Offsets arrive as a pair or not at all, and never invert.
  CONSTRAINT trend_claim_spans_offsets CHECK (
    (char_start IS NULL AND char_end IS NULL)
    OR (char_start IS NOT NULL AND char_end IS NOT NULL
        AND char_start >= 0 AND char_end > char_start)
  ),
  -- 'unresolved' and "has no offsets" are the same fact. Letting them disagree
  -- would make every reader check both.
  CONSTRAINT trend_claim_spans_kind_agrees CHECK (
    (match_kind = 'unresolved') = (char_start IS NULL)
  ),
  CONSTRAINT trend_claim_spans_quote_nonempty CHECK (length(btrim(quote)) > 0)
);

CREATE INDEX IF NOT EXISTS trend_claim_spans_claim_idx
  ON trend_claim_spans (trend_claim_id);
-- The reverse direction: which claims rest on this dream's words.
CREATE INDEX IF NOT EXISTS trend_claim_spans_dream_idx
  ON trend_claim_spans (dream_id)
  WHERE char_start IS NOT NULL;

-- Extends the 0007 trigger set. A span is a finding about an immutable pair —
-- a claim that cannot be rewritten and a transcript that cannot be rewritten —
-- so it has nothing legitimate to be updated to. DELETE stays open: it is how
-- a bad run is discarded, and it is what the two cascades above rely on.
DROP TRIGGER IF EXISTS trend_claim_spans_no_update ON trend_claim_spans;
CREATE TRIGGER trend_claim_spans_no_update
  BEFORE UPDATE ON trend_claim_spans
  FOR EACH ROW EXECUTE FUNCTION rehm_reject_update();

-- SELECT + INSERT, as specified. DELETE is not granted and is not needed: the
-- two ON DELETE CASCADEs run with the privileges of the constraint, not the
-- caller, so discarding a run or a dream still clears its spans.
REVOKE ALL ON trend_claim_spans FROM rehm_app;
GRANT SELECT, INSERT ON trend_claim_spans TO rehm_app;

-- Verbatim quotes lifted while a batch is being read, as
-- [{ "id": "b2q7", "dream_number": 4, "quote": "..." }].
--
-- They have to be lifted here because this is the only stage that sees the
-- transcripts: synthesis works from batch observations, and asking it to quote
-- from those would be asking it to reproduce text it was never shown. The
-- synthesis step then cites a quote by id, so the string it attaches to a claim
-- is the string this stage copied, not one retyped from memory.
--
-- Working state on a working table, cleaned up with the job.
ALTER TABLE trend_job_batches ADD COLUMN IF NOT EXISTS quotes jsonb;

INSERT INTO schema_migrations (version)
VALUES ('0024_claim_spans.sql')
ON CONFLICT (version) DO NOTHING;
