-- rehm — Milestone 3 corrections
--
-- Apply in the Neon SQL editor as the OWNER role, after 0001.
--
-- What this does:
--   1. Role separation for dreams immutability. The tables are owned by the
--      owner (migration) role. A separate app role gets SELECT + INSERT on
--      dreams and full DML on every other table — but never UPDATE/DELETE on
--      dreams, and it cannot grant those to itself because it is not the
--      owner. DATABASE_URL points at the app role; the owner credential lives
--      only in the Neon console / SQL editor, never in the app runtime env.
--   2. Referential validation of trend_claims.dream_ids. Arrays take no FK and
--      these ids are model-generated, so a hallucinated uuid would satisfy the
--      non-empty CHECK. A constraint trigger enforces that every element
--      exists in dreams and is owned by the same user as the parent trend_run.
--
-- The app role name is `rehm_app` (not a secret). Provision its login +
-- password out of band — in the Neon console, or a one-off
--   ALTER ROLE rehm_app WITH LOGIN PASSWORD '...';
-- run manually in the SQL editor (never committed) — then point DATABASE_URL
-- at it. This migration only creates the role (if absent) and sets grants.

-- 1a. App role. Created NOLOGIN if it does not already exist; login/password
-- is provisioned separately (see header). If you created it in the console
-- first, this block is a no-op.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rehm_app') THEN
    CREATE ROLE rehm_app NOLOGIN;
  END IF;
END
$$;

-- 1b. Let the owner SET ROLE rehm_app to run the immutability proof from the
-- SQL editor. Harmless: the owner can already do anything to its own objects.
GRANT rehm_app TO CURRENT_USER;

-- 1c. Privileges.
GRANT USAGE ON SCHEMA public TO rehm_app;

-- dreams: read + append only. No UPDATE, no DELETE — ever.
GRANT SELECT, INSERT ON dreams TO rehm_app;

-- Every other domain table: full DML.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  restatements,
  analyses,
  trend_runs,
  trend_claims,
  concepts,
  tagging_runs,
  taggings
TO rehm_app;

-- Migration ledger: read only. The app must never rewrite migration history.
GRANT SELECT ON schema_migrations TO rehm_app;

-- 2. Referential validation for trend_claims.dream_ids. The non-empty CHECK
-- from 0001 stays as-is; this adds existence + ownership checks per element.
CREATE OR REPLACE FUNCTION trend_claims_validate_dream_ids()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  run_user      uuid;
  invalid_count integer;
BEGIN
  SELECT user_id INTO run_user
  FROM trend_runs
  WHERE id = NEW.trend_run_id;

  -- Count elements that either do not exist in dreams or whose owner differs
  -- from the trend_run's user. IS DISTINCT FROM is NULL-safe (a NULL array
  -- element left-joins to no row, so d.id IS NULL catches it).
  SELECT count(*)
  INTO invalid_count
  FROM unnest(NEW.dream_ids) AS elem(dream_id)
  LEFT JOIN dreams d ON d.id = elem.dream_id
  WHERE d.id IS NULL
     OR d.user_id IS DISTINCT FROM run_user;

  IF invalid_count > 0 THEN
    RAISE EXCEPTION
      'trend_claims.dream_ids has % element(s) that are missing from dreams or not owned by user % (trend_run %)',
      invalid_count, run_user, NEW.trend_run_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trend_claims_dream_ids_referential ON trend_claims;
CREATE CONSTRAINT TRIGGER trend_claims_dream_ids_referential
AFTER INSERT OR UPDATE ON trend_claims
FOR EACH ROW
EXECUTE FUNCTION trend_claims_validate_dream_ids();

-- Record this migration so the Node runner won't reapply it.
INSERT INTO schema_migrations (version)
VALUES ('0002_app_role_and_referential_integrity.sql')
ON CONFLICT (version) DO NOTHING;
