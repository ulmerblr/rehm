-- rehm schema — Milestone 3
--
-- Apply this in the Neon SQL editor as the OWNER role (the default Neon role
-- that owns the database). Run 0001 then 0002 in order, both as the owner.
--
-- OWNER: applied by the single Vercel-managed Neon owner role. migration_owner
-- records that role for the repo record; there is no longer an assertion pinning
-- later migrations to it (a single owner made the pin moot, and it could not be
-- planned on an empty DB). Append-only is enforced by the 0007 triggers.
--
-- Conventions:
--   * Primary keys: uuid, default gen_random_uuid() (built-in, Postgres 13+)
--   * Timestamps:   timestamptz, default now()
--   * user_id:      uuid, no FK yet (native auth + hub SSO arrive later)
--
-- Invariants:
--   * dreams is INSERT-ONLY for the app role (role separation in 0002).
--   * restatements and analyses are independent SIBLINGS derived from
--     dreams.raw_transcript — NO foreign key between them.
--   * Every derived row carries NOT NULL model + prompt_version.
--   * trend_claims.dream_ids non-empty (CHECK) + referentially valid (0002).

-- (owner-pin assertion removed: single Vercel-managed owner, so it guarded
-- nothing and could not be planned on an empty DB. DB-level immutability is
-- enforced by the triggers in 0007, which fire for every role.)

-- Print the applying role for the record.
SELECT current_user AS applying_role;

-- Migration ledger. Created here so an owner running this file in the Neon SQL
-- editor bootstraps it; the Node runner reads it to avoid reapplying.
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

-- Owner pin (singleton). Captures the owner role from the first apply of 0001.
CREATE TABLE IF NOT EXISTS migration_owner (
  singleton  boolean PRIMARY KEY DEFAULT true,
  owner_role text NOT NULL,
  pinned_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT migration_owner_singleton CHECK (singleton)
);
INSERT INTO migration_owner (owner_role)
VALUES (current_user)
ON CONFLICT (singleton) DO NOTHING;

-- Immutable primary record. UPDATE/DELETE withheld from the app role in 0002.
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
-- ON DELETE CASCADE: purging a bad trend_run discards its claims atomically.
CREATE TABLE trend_claims (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trend_run_id  uuid NOT NULL REFERENCES trend_runs (id) ON DELETE CASCADE,
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

-- A pass that tags dreams with concepts. corpus_size NOT NULL (matches
-- trend_runs): the corpus size is what makes a run interpretable later.
CREATE TABLE tagging_runs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL,
  corpus_size    integer NOT NULL,
  model          text NOT NULL,
  prompt_version text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- A single (concept, dream) tag produced by a tagging run.
-- ON DELETE CASCADE on tagging_run_id: purging a bad tagging_run discards its
-- taggings atomically. dream_id and concept_id do NOT cascade — deleting a run
-- must never reach dreams or concepts.
CREATE TABLE taggings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id     uuid NOT NULL REFERENCES concepts (id),
  dream_id       uuid NOT NULL REFERENCES dreams (id),
  tagging_run_id uuid NOT NULL REFERENCES tagging_runs (id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX taggings_run_idx ON taggings (tagging_run_id);

-- Record this migration so the Node runner won't reapply it.
INSERT INTO schema_migrations (version)
VALUES ('0001_init.sql')
ON CONFLICT (version) DO NOTHING;
