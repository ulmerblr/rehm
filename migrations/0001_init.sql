-- rehm schema — Milestone 3
--
-- Conventions:
--   * Primary keys: uuid, default gen_random_uuid() (built-in, Postgres 13+)
--   * Timestamps:   timestamptz, default now()
--   * user_id:      uuid, no FK yet (no users table this milestone; native
--                   auth + hub SSO arrive later and will supply these ids)
--
-- Invariants carried from the project notes:
--   * dreams is INSERT-ONLY, enforced at the DB level (REVOKE at the bottom).
--   * restatements and analyses are independent SIBLINGS derived from
--     dreams.raw_transcript — NO foreign key between them in either direction.
--   * Every derived row carries NOT NULL model + prompt_version.
--   * trend_claims.dream_ids must be non-empty (DB CHECK).

-- Immutable primary record. UPDATE/DELETE revoked from the app role below.
CREATE TABLE dreams (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL,
  dreamt_on      date,
  captured_at    timestamptz NOT NULL DEFAULT now(),
  raw_transcript text NOT NULL,
  capture_method text
);
CREATE INDEX dreams_user_dreamt_idx ON dreams (user_id, dreamt_on);

-- Sibling of analyses. Many per dream. No FK to analyses.
CREATE TABLE restatements (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dream_id       uuid NOT NULL REFERENCES dreams (id),
  body           text,
  model          text NOT NULL,
  prompt_version text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Sibling of restatements. Many per dream. No FK to restatements.
CREATE TABLE analyses (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dream_id       uuid NOT NULL REFERENCES dreams (id),
  body           text,
  model          text NOT NULL,
  prompt_version text NOT NULL,
  blind          boolean NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Periodic corpus-wide trend run.
CREATE TABLE trend_runs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL,
  corpus_size    integer NOT NULL,
  model          text NOT NULL,
  prompt_version text NOT NULL,
  body           text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Individual claims produced by a trend run, each citing >= 1 dream.
CREATE TABLE trend_claims (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trend_run_id  uuid NOT NULL REFERENCES trend_runs (id),
  claim         text NOT NULL,
  dream_ids     uuid[] NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- array_length returns NULL on an empty array, so the coalesce is required:
  -- a bare array_length(...) > 0 check would pass empty arrays silently.
  CONSTRAINT trend_claims_dream_ids_nonempty
    CHECK (coalesce(array_length(dream_ids, 1), 0) > 0)
);
CREATE INDEX trend_claims_run_idx ON trend_claims (trend_run_id);

-- Named concepts, unique per user.
CREATE TABLE concepts (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                    uuid NOT NULL,
  name                       text NOT NULL,
  first_named_at_corpus_size integer,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT concepts_user_name_uniq UNIQUE (user_id, name)
);

-- A pass that tags dreams with concepts.
CREATE TABLE tagging_runs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL,
  corpus_size    integer,
  model          text NOT NULL,
  prompt_version text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- A single (concept, dream) tag produced by a tagging run.
CREATE TABLE taggings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id     uuid NOT NULL REFERENCES concepts (id),
  dream_id       uuid NOT NULL REFERENCES dreams (id),
  tagging_run_id uuid NOT NULL REFERENCES tagging_runs (id),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX taggings_run_idx ON taggings (tagging_run_id);

-- Database-level immutability for dreams: the connecting (app) role keeps
-- SELECT + INSERT but loses UPDATE + DELETE. Neon roles are not superusers,
-- so revoking from the owner makes the table append-only even for itself.
REVOKE UPDATE, DELETE ON dreams FROM CURRENT_USER;
GRANT SELECT, INSERT ON dreams TO CURRENT_USER;
