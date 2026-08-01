-- rehm — Milestone: dream titles
--
-- Apply after 0009 (auto-applied on deploy; no manual step).
--
-- Adds an optional short title to each dream, generated best-effort at capture
-- from the raw transcript (a cheap call on the small model). It is display-only
-- metadata for the dream list; it is set once at INSERT (dreams is immutable —
-- 0007 blocks UPDATE), and when it is absent the list falls back to a title
-- derived from the transcript. ADD COLUMN is DDL, so the row triggers do not
-- fire here.
--
-- Also widen the usage-ledger kind so the title's tokens can be recorded as
-- real spend alongside restatements, analyses, and trends.

SELECT current_user AS applying_role;

ALTER TABLE dreams ADD COLUMN title text;

ALTER TABLE usage_events DROP CONSTRAINT usage_events_kind_check;
ALTER TABLE usage_events
  ADD CONSTRAINT usage_events_kind_check
  CHECK (kind IN ('restatement', 'analysis', 'trend', 'title'));

INSERT INTO schema_migrations (version)
VALUES ('0010_dream_title.sql')
ON CONFLICT (version) DO NOTHING;
