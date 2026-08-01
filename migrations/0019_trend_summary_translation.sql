-- rehm — Milestone: the trend summary is translatable too
--
-- Apply after 0018 (auto-applied on deploy; no manual step).
--
-- A trend run displays three pieces of generated text: an opening summary
-- (trend_runs.body), the individual claims, and the closing. 0018 registered
-- the claims and the closing and missed the summary, so on a dual-language
-- account a pass rendered with its first paragraph in the language it was
-- written in and everything under it translated.
--
-- The summary needs its own source_type rather than sharing 'trend_closing':
-- both are keyed to the trend run's id, so one type would collide on
-- translations_source_uniq and the second one written would be dropped.
--
-- No backfill is needed here. pendingItems derives its work list from what has
-- no translation yet, so existing summaries simply start appearing in it, and
-- Settings offers to translate them the next time it is opened.

SELECT current_user AS applying_role;

-- Widen the source_type check. Found by definition rather than by a guessed
-- name, and skipped entirely if 0018 hasn't landed yet.
DO $$
DECLARE cname text;
BEGIN
  IF to_regclass('public.translations') IS NULL THEN
    RETURN;
  END IF;

  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.translations'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%source_type%';

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE translations DROP CONSTRAINT %I', cname);
  END IF;

  ALTER TABLE translations
    ADD CONSTRAINT translations_source_type_check
    CHECK (source_type IN (
      'dream', 'addendum', 'title', 'restatement',
      'analysis', 'trend_summary', 'trend_closing', 'trend_claim'));
END $$;

INSERT INTO schema_migrations (version)
VALUES ('0019_trend_summary_translation.sql')
ON CONFLICT (version) DO NOTHING;
