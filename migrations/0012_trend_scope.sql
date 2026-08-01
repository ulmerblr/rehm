-- rehm — Milestone: scoped trend runs
--
-- Apply after 0011 (auto-applied on deploy; no manual step).
--
-- A trend run no longer always covers the entire corpus: it can be scoped to
-- the last N dreams, or to a date range (past week/month/year, or explicit
-- dates). Record the scope on the run so an old run stays interpretable — a
-- claim made over "the last 5 dreams" means something different from the same
-- claim made over everything. trend_runs is immutable, so the scope is captured
-- at INSERT.
--
-- Backfill without UPDATE: trend_runs is append-only and the 0007 trigger
-- rejects UPDATE for every role, so existing rows are backfilled by ADDing the
-- column WITH a DEFAULT (Postgres applies it to existing rows) and then DROPping
-- the default, so future inserts must state the scope explicitly. ADD/ALTER
-- COLUMN is DDL, so the row triggers never fire.

SELECT current_user AS applying_role;

ALTER TABLE trend_runs ADD COLUMN IF NOT EXISTS scope_kind   text DEFAULT 'all';
ALTER TABLE trend_runs ADD COLUMN IF NOT EXISTS scope_label  text DEFAULT 'All dreams';
ALTER TABLE trend_runs ADD COLUMN IF NOT EXISTS scope_last_n integer;
ALTER TABLE trend_runs ADD COLUMN IF NOT EXISTS scope_from   date;
ALTER TABLE trend_runs ADD COLUMN IF NOT EXISTS scope_to     date;

ALTER TABLE trend_runs ALTER COLUMN scope_kind  DROP DEFAULT;
ALTER TABLE trend_runs ALTER COLUMN scope_label DROP DEFAULT;

-- Constrain the kind now that existing rows carry a value.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.trend_runs'::regclass
      AND conname = 'trend_runs_scope_kind_check'
  ) THEN
    ALTER TABLE trend_runs
      ADD CONSTRAINT trend_runs_scope_kind_check
      CHECK (scope_kind IS NULL OR scope_kind IN ('all', 'last_n', 'range'));
  END IF;
END $$;

INSERT INTO schema_migrations (version)
VALUES ('0012_trend_scope.sql')
ON CONFLICT (version) DO NOTHING;
