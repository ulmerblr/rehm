-- rehm — Milestone: trend passes as a queued, batched job
--
-- Apply after 0015 (auto-applied on deploy; no manual step).
--
-- A whole-corpus trend pass cannot run in one HTTP request: the serverless
-- function has a hard time limit and the corpus only grows. So a pass becomes a
-- JOB made of BATCHES. Each batch reads a few dreams and records observations;
-- when every batch is done, one synthesis step turns those observations into
-- the final claims. Each step finishes well inside the limit, so the method
-- scales to any number of dreams, and an interrupted pass can be resumed
-- instead of restarted.
--
-- These two tables are deliberately MUTABLE — unlike dreams and trend_runs,
-- they are working state, not the record. Status transitions and partial
-- results have to be writable. The immutable artifact is still the trend_run
-- the job produces at the end, which is written once and never touched.

SELECT current_user AS applying_role;

CREATE TABLE IF NOT EXISTS trend_jobs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users (id),
  status         text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'done', 'failed', 'canceled')),
  source         text NOT NULL,
  scope_kind     text NOT NULL,
  scope_label    text NOT NULL,
  scope_last_n   integer,
  scope_from     date,
  scope_to       date,
  dream_numbers  integer[] NOT NULL,
  total_batches  integer NOT NULL,
  trend_run_id   uuid REFERENCES trend_runs (id),
  error          text,
  input_tokens   integer NOT NULL DEFAULT 0,
  output_tokens  integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trend_jobs_user_idx ON trend_jobs (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS trend_job_batches (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id         uuid NOT NULL REFERENCES trend_jobs (id) ON DELETE CASCADE,
  batch_no       integer NOT NULL,
  dream_ids      uuid[] NOT NULL,
  dream_numbers  integer[] NOT NULL,
  status         text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'running', 'done', 'failed')),
  observations   text,
  error          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trend_job_batches_order_uniq UNIQUE (job_id, batch_no)
);
CREATE INDEX IF NOT EXISTS trend_job_batches_job_idx
  ON trend_job_batches (job_id, batch_no);

-- Working state: the app must be able to update and clean these up.
REVOKE ALL ON trend_jobs, trend_job_batches FROM rehm_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON trend_jobs, trend_job_batches TO rehm_app;

INSERT INTO schema_migrations (version)
VALUES ('0016_trend_jobs.sql')
ON CONFLICT (version) DO NOTHING;
