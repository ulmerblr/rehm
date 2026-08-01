-- rehm — Milestone: dream titles, applied as a NEW version
--
-- Why this exists as 0011 instead of an edit to 0010: migrations are tracked by
-- filename. 0010 was rewritten in place after an earlier version of it had
-- already been recorded on some databases, so the new content would be skipped
-- forever as "already applied" and dream_titles would never be created. Never
-- change a migration's content after it ships — add a new one.
--
-- This file is fully idempotent and safe under EVERY prior state:
--   * 0010 never applied            -> creates everything here
--   * old 0010 applied (dreams.title) -> creates dream_titles, backfills from it
--   * new 0010 applied              -> all IF NOT EXISTS / no-ops

SELECT current_user AS applying_role;

-- Editable title metadata. Deliberately NOT on dreams: dreams is append-only
-- (0007), and a title must be renameable.
CREATE TABLE IF NOT EXISTS dream_titles (
  dream_id   uuid PRIMARY KEY REFERENCES dreams (id) ON DELETE CASCADE,
  title      text NOT NULL,
  source     text NOT NULL DEFAULT 'generated',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON dream_titles TO rehm_app;

-- Widen usage_events.kind to allow 'title'. The constraint is found by
-- definition, not by a guessed name, and the whole thing is skipped if
-- usage_events isn't there yet.
DO $$
DECLARE cname text;
BEGIN
  IF to_regclass('public.usage_events') IS NULL THEN
    RETURN;
  END IF;

  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.usage_events'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%kind%';

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE usage_events DROP CONSTRAINT %I', cname);
  END IF;

  ALTER TABLE usage_events
    ADD CONSTRAINT usage_events_kind_check
    CHECK (kind IN ('restatement', 'analysis', 'trend', 'title'));
END $$;

-- If an earlier build added dreams.title, carry those titles across so nothing
-- is lost, then drop the column: titles do not belong on the immutable table.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dreams' AND column_name = 'title'
  ) THEN
    INSERT INTO dream_titles (dream_id, title, source)
    SELECT id, title, 'generated' FROM dreams
    WHERE title IS NOT NULL AND btrim(title) <> ''
    ON CONFLICT (dream_id) DO NOTHING;

    ALTER TABLE dreams DROP COLUMN title;
  END IF;
END $$;

INSERT INTO schema_migrations (version)
VALUES ('0011_dream_titles_fix.sql')
ON CONFLICT (version) DO NOTHING;
