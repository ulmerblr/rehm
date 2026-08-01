-- rehm — Milestone: what a trend pass reads
--
-- Apply after 0014 (auto-applied on deploy; no manual step).
--
-- A trend pass has always read the raw transcripts. That is the conservative
-- default and stays the default: trends drawn from what the dreamer actually
-- said are grounded, whereas trends drawn from prior interpretations risk the
-- model finding patterns in its own earlier output.
--
-- But interpretations surface themes the literal text never states, so the run
-- can optionally also read each dream's most recent analysis. Which one was
-- used changes what a claim means, and trend_runs is immutable, so the choice
-- is recorded on the run.
--
-- Backfilled by ADDing WITH a default and then DROPping it — trend_runs rejects
-- UPDATE for every role (0007).

SELECT current_user AS applying_role;

ALTER TABLE trend_runs ADD COLUMN IF NOT EXISTS source text DEFAULT 'dreams';
ALTER TABLE trend_runs ALTER COLUMN source DROP DEFAULT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.trend_runs'::regclass
      AND conname = 'trend_runs_source_check'
  ) THEN
    ALTER TABLE trend_runs
      ADD CONSTRAINT trend_runs_source_check
      CHECK (source IS NULL OR source IN ('dreams', 'dreams_and_analyses'));
  END IF;
END $$;

INSERT INTO schema_migrations (version)
VALUES ('0015_trend_source.sql')
ON CONFLICT (version) DO NOTHING;
