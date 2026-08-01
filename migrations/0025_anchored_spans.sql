-- rehm — Milestone: a fourth kind of match
--
-- Apply after 0024 (auto-applied on deploy; no manual step).
--
-- 0024 shipped with three match kinds, and three turned out to be too few. The
-- first real analyses put on screen showed several quotations going unlinked
-- for one reason the ladder had no rung for: the quote is real, and its middle
-- is not contiguous in the transcript.
--
--   "you're just a player just like I am... if I didn't do something right"
--
-- That was said. It was said with a sentence in between that the analysis
-- elided, so no amount of normalizing will ever find it as one string. Same
-- shape when prose tightens a run of speech rather than marking the cut.
--
-- 'anchored' means: both ends were found verbatim, in order, and the span runs
-- from one to the other — including whatever sits between them. It is a weaker
-- claim than 'exact' or 'normalized' and it is counted separately for exactly
-- that reason. The point of the tally is to say whether the model is quoting or
-- inventing, and folding a looser match into a stricter bucket would blunt the
-- one number that answers it.
--
-- Both ends must match, which is what keeps it honest: a quote invented whole
-- has no ends to find, and the span is refused if it stretches to more than
-- three times the quote's own length, so two common phrases far apart cannot
-- accidentally "resolve" to everything between them.
--
-- No backfill. Existing rows keep the kind they were written with; a run made
-- before this can only be re-measured by running it again, and its stored
-- unresolved rows are still the truth about what that run produced.

SELECT current_user AS applying_role;

ALTER TABLE trend_claim_spans DROP CONSTRAINT IF EXISTS trend_claim_spans_match_kind_check;

DO $$
DECLARE cname text;
BEGIN
  -- The inline CHECK in 0024 was auto-named; find it by what it constrains
  -- rather than by guessing the name Postgres chose.
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.trend_claim_spans'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%match_kind%'
    AND pg_get_constraintdef(oid) NOT ILIKE '%char_start%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE trend_claim_spans DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE trend_claim_spans
  ADD CONSTRAINT trend_claim_spans_match_kind_check
  CHECK (match_kind IN ('exact', 'normalized', 'anchored', 'unresolved'));

INSERT INTO schema_migrations (version)
VALUES ('0025_anchored_spans.sql')
ON CONFLICT (version) DO NOTHING;
