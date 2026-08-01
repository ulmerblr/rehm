-- rehm — Milestone: dream titles (editable)
--
-- Apply after 0009 (auto-applied on deploy; no manual step).
--
-- A dream's title is a short, editable label for the list — NOT part of the
-- immutable transcript. So it lives in its own table, not on dreams (which 0007
-- makes append-only). One row per dream, upserted: generated best-effort at
-- capture, and freely overwritten when the user types their own. Deleting a
-- dream cascades its title away. When a dream has no row here, the list derives
-- a title from the transcript.
--
-- Also widen the usage-ledger kind so the title's tokens count as real spend.
-- The old CHECK is dropped by discovering its name from the catalog, so this is
-- robust to however Postgres named it.

SELECT current_user AS applying_role;

CREATE TABLE IF NOT EXISTS dream_titles (
  dream_id   uuid PRIMARY KEY REFERENCES dreams (id) ON DELETE CASCADE,
  title      text NOT NULL,
  source     text NOT NULL DEFAULT 'generated' CHECK (source IN ('generated', 'edited')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Editable metadata, not an immutable record: the app may read, write, change,
-- and remove a title. (rehm_app is inert here, but keep the grant auditable.)
GRANT SELECT, INSERT, UPDATE, DELETE ON dream_titles TO rehm_app;

-- Widen usage_events.kind to include 'title', name-independently.
DO $$
DECLARE cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'usage_events'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%kind%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE usage_events DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE usage_events
  ADD CONSTRAINT usage_events_kind_check
  CHECK (kind IN ('restatement', 'analysis', 'trend', 'title'));

INSERT INTO schema_migrations (version)
VALUES ('0010_dream_title.sql')
ON CONFLICT (version) DO NOTHING;
