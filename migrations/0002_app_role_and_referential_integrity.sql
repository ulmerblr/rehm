-- rehm — Milestone 3 corrections + role hardening
--
-- Apply in the Neon SQL editor as the OWNER role, after 0001.
--
-- What this does:
--   1. Role separation for an append-only architecture. The tables are owned
--      by the owner (migration) role. A separate app role, rehm_app, gets:
--        - dreams:          SELECT, INSERT           (immutable primary record)
--        - derived tables:  SELECT, INSERT, DELETE   (append-only + purge)
--        - never UPDATE on any table, and it cannot grant itself privileges
--          because it is not the owner.
--      DATABASE_URL points at rehm_app; the owner credential lives only in the
--      Neon SQL editor, never in the app runtime env.
--   2. Referential validation of trend_claims.dream_ids (constraint trigger).
--
-- rehm_app MUST be created here, via SQL — never in the Neon console. Console
-- roles are granted membership in neon_superuser, which can reach tables it
-- does not own and would void this separation (while the proof might still
-- print "permission denied"). SQL-created roles get no such membership.
-- If CREATE ROLE fails for the owner, STOP and report — do not route around it.
--
-- rehm_app is created NOLOGIN and carries no secret. Provision its login +
-- password out of band with an uncommitted statement in the SQL editor:
--   ALTER ROLE rehm_app WITH LOGIN PASSWORD '...';
-- then point DATABASE_URL at rehm_app.
--
-- OWNER PIN: must be applied as the same owner role that applied 0001, so the
-- ALTER DEFAULT PRIVILEGES below (no FOR ROLE) binds to that owner. Asserted.

-- Owner-pin assertion (see migrations/OWNER_ROLE.md). Fails loud if this is
-- applied by any role other than the one that applied 0001.
DO $$
BEGIN
  IF to_regclass('public.migration_owner') IS NOT NULL
     AND EXISTS (SELECT 1 FROM migration_owner)
     AND current_user <> (SELECT owner_role FROM migration_owner) THEN
    RAISE EXCEPTION
      'migration must be applied as pinned owner role "%", but current_user is "%"',
      (SELECT owner_role FROM migration_owner), current_user;
  END IF;
END
$$;

-- Capture and print the applying (owner) role for the repo record.
SELECT current_user AS applying_role;

-- 1a. App role — SQL only. No IF NOT EXISTS: if it already exists (e.g. from a
-- prior partial run, or wrongly created in the console) this errors so the
-- operator investigates rather than silently accepting a tainted role.
CREATE ROLE rehm_app NOLOGIN;

-- 1b. Privileges on existing tables.
GRANT USAGE ON SCHEMA public TO rehm_app;

-- dreams: read + append only. No UPDATE, no DELETE — ever.
GRANT SELECT, INSERT ON dreams TO rehm_app;

-- trend_runs: read + append only. No DELETE — a trend run is versioned and
-- must stay readable so an old hypothesis can be scored when new dreams
-- arrive, not quietly revised. The ON DELETE CASCADE to trend_claims (0001)
-- is for deliberate owner-credential purges only, never the app.
GRANT SELECT, INSERT ON trend_runs TO rehm_app;

-- Remaining derived tables: append-only + purge. SELECT, INSERT, DELETE —
-- NO UPDATE. Discarding a bad run (DELETE) is allowed; editing a record is
-- not. restatements/analyses accumulate per dream; taggings are recomputed as
-- new rows tied to a new tagging_run; concepts are re-created, not renamed;
-- trend_claims are re-derivable, so DELETE here is harmless.
GRANT SELECT, INSERT, DELETE ON
  restatements,
  analyses,
  trend_claims,
  concepts,
  tagging_runs,
  taggings
TO rehm_app;

-- Control tables: unreachable by the app. schema_migrations and
-- migration_owner are created in 0001, before the ALTER DEFAULT PRIVILEGES
-- below, so they carry no default rehm_app grant — but revoke explicitly so
-- the intent is auditable and survives any future re-grant. Any NEW control
-- table added in a later migration MUST carry its own REVOKE (default
-- privileges on schema public grant SELECT/INSERT/DELETE to rehm_app).
REVOKE ALL ON schema_migrations, migration_owner FROM rehm_app;

-- Defensive, auditable statement of the append-only architecture: rehm_app
-- holds UPDATE on nothing, and DELETE on neither dreams nor trend_runs.
-- (No-ops where the privilege was never granted above.)
REVOKE UPDATE ON
  dreams,
  restatements,
  analyses,
  trend_runs,
  trend_claims,
  concepts,
  tagging_runs,
  taggings
FROM rehm_app;
REVOKE DELETE ON dreams, trend_runs FROM rehm_app;

-- 1c. Future tables created by the owner inherit the same append-only grants
-- (SELECT, INSERT, DELETE — no UPDATE). FOR ROLE is omitted, so this targets
-- the owner running this migration. dreams keeps SELECT + INSERT only via its
-- explicit grant above; future migrations must not issue blanket grants that
-- re-open dreams to UPDATE/DELETE.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, DELETE ON TABLES TO rehm_app;

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
