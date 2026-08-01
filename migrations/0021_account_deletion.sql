-- rehm — Milestone: account roles and account deletion
--
-- Apply after 0020 (auto-applied on deploy; no manual step).
--
-- Two related things.
--
-- ROLE. There has never been an owner concept — every account was equal, so
-- nobody could remove a test signup or a friend who left. The earliest account
-- becomes the owner: it is the one that set the instance up, so no email needs
-- hardcoding here and the answer stays right if the database is ever restored
-- elsewhere.
--
-- DELETION. Erasing an account has to remove everything derived from it, and
-- two tables are deliberately un-deletable by any role:
--
--   trend_runs, so a claim made at nine dreams stays checkable at twenty.
--   usage_events, so deleting a dream cannot erase what the key was billed.
--
-- Both of those protect a record from its own owner editing history. Neither
-- rationale survives the account itself being erased — there is no longer
-- anyone for the record to be honest to. So they gain a gated delete, exactly
-- like dreams did in 0008, but behind a DIFFERENT flag: rehm.allow_account_delete.
--
-- The distinct flag is the point. The dream-delete route sets only
-- rehm.allow_delete, so it still cannot reach a trend run or the spend ledger.
-- Nothing about the existing guarantees is weakened; a strictly narrower new
-- door is added, and only the account-delete path holds the key.

SELECT current_user AS applying_role;

ALTER TABLE users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass AND conname = 'users_role_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_role_check
      CHECK (role IN ('member', 'owner'));
  END IF;
END $$;

-- The first account to exist is the one that stood the instance up.
UPDATE users SET role = 'owner'
WHERE id = (SELECT id FROM users ORDER BY created_at ASC, id ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM users WHERE role = 'owner');

-- DELETE only inside a transaction that opted in specifically to erasing an
-- account. Separate from rehm.allow_delete on purpose — see the header.
CREATE OR REPLACE FUNCTION rehm_guard_account_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('rehm.allow_account_delete', true) = 'on' THEN
    RETURN OLD;  -- deliberate, transaction-scoped account erasure
  END IF;
  RAISE EXCEPTION
    'DELETE on % is forbidden: rows here are immutable unless a transaction sets rehm.allow_account_delete = ''on''',
    TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$;

-- trend_runs: split the combined trigger so UPDATE stays hard-blocked while
-- DELETE goes through the new guard. TRUNCATE (0007) is untouched.
DROP TRIGGER IF EXISTS trend_runs_no_mutate ON trend_runs;
DROP TRIGGER IF EXISTS trend_runs_no_update ON trend_runs;
CREATE TRIGGER trend_runs_no_update
  BEFORE UPDATE ON trend_runs
  FOR EACH ROW EXECUTE FUNCTION rehm_reject_update();
DROP TRIGGER IF EXISTS trend_runs_no_delete ON trend_runs;
CREATE TRIGGER trend_runs_no_delete
  BEFORE DELETE ON trend_runs
  FOR EACH ROW EXECUTE FUNCTION rehm_guard_account_delete();

-- usage_events: same split. A dream delete still cannot touch the ledger.
DROP TRIGGER IF EXISTS usage_events_no_mutate ON usage_events;
DROP TRIGGER IF EXISTS usage_events_no_update ON usage_events;
CREATE TRIGGER usage_events_no_update
  BEFORE UPDATE ON usage_events
  FOR EACH ROW EXECUTE FUNCTION rehm_reject_update();
DROP TRIGGER IF EXISTS usage_events_no_delete ON usage_events;
CREATE TRIGGER usage_events_no_delete
  BEFORE DELETE ON usage_events
  FOR EACH ROW EXECUTE FUNCTION rehm_guard_account_delete();

-- The app role needs DELETE on both to run the cascade; the triggers are what
-- actually decide, and they still refuse outside an opted-in transaction.
GRANT DELETE ON trend_runs, usage_events TO rehm_app;

INSERT INTO schema_migrations (version)
VALUES ('0021_account_deletion.sql')
ON CONFLICT (version) DO NOTHING;
