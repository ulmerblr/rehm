-- rehm — Milestone: DB-level append-only enforcement (triggers)
--
-- Apply in the Neon SQL editor as the OWNER role, after 0006 (or via the Node
-- runner / the temporary /api/migrate route).
--
-- WHY TRIGGERS, NOT GRANTS. The original design (0002) enforced append-only by
-- withholding UPDATE/DELETE from a separate rehm_app role. That role never got a
-- login: the Neon database is provisioned solely through the Vercel integration,
-- which hands the app the OWNER connection string, and there is no Neon console
-- to give rehm_app a password. So the app connects as the table OWNER, and grant
-- restrictions do not apply to the owner. Triggers do: a BEFORE trigger fires for
-- EVERY role, owner included. These triggers are therefore the ACTUAL immutability
-- guarantee for the dream corpus and its derivations, independent of role.
--
-- WHAT IS ENFORCED (mirrors the privilege matrix in 0002/0004/0005):
--   dreams, trend_runs, restatement_turns  -> no UPDATE, no DELETE, no TRUNCATE
--       (immutable primary record; versioned trend runs kept readable; the
--        negotiation record of proposals/objections must never be rewritten)
--   restatements                           -> no DELETE, no TRUNCATE; UPDATE may
--       change ONLY accepted/accepted_at/input_tokens/output_tokens
--   analyses, trend_claims, concepts,      -> no UPDATE (DELETE allowed: a bad
--   tagging_runs, taggings                     run is re-derivable, so discard +
--                                              re-insert is the edit path)
--
-- users and user_api_keys are deliberately NOT covered: they are auth plumbing,
-- not the immutable corpus, and the app legitimately UPDATEs user_api_keys
-- (status, last_verified_at). Append-only here is about the dream record.

SELECT current_user AS applying_role;

-- Reject any UPDATE or DELETE (append-only, no purge).
CREATE OR REPLACE FUNCTION rehm_reject_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    '% on % is forbidden: this table is append-only and immutable in rehm',
    TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$;

-- Reject UPDATE only (DELETE is a permitted purge path for re-derivable rows).
CREATE OR REPLACE FUNCTION rehm_reject_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'UPDATE on % is forbidden: rows here are immutable; discard with DELETE and re-insert instead',
    TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$;

-- Reject DELETE only.
CREATE OR REPLACE FUNCTION rehm_reject_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'DELETE on % is forbidden: this table is append-only in rehm',
    TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$;

-- Reject TRUNCATE (statement-level; TRUNCATE bypasses row triggers and the
-- owner would otherwise be able to wipe an "immutable" table wholesale).
CREATE OR REPLACE FUNCTION rehm_reject_truncate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'TRUNCATE on % is forbidden: this table is append-only in rehm',
    TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$;

-- restatements: mutable ONLY in accepted/accepted_at/input_tokens/output_tokens.
-- Any change to the identity or content columns is rejected; the generated
-- restatement body and its provenance stay immutable.
CREATE OR REPLACE FUNCTION rehm_restatements_guard_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id             IS DISTINCT FROM OLD.id
     OR NEW.dream_id       IS DISTINCT FROM OLD.dream_id
     OR NEW.body           IS DISTINCT FROM OLD.body
     OR NEW.model          IS DISTINCT FROM OLD.model
     OR NEW.prompt_version IS DISTINCT FROM OLD.prompt_version
     OR NEW.created_at     IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION
      'UPDATE on restatements may change only accepted/accepted_at/input_tokens/output_tokens; id/dream_id/body/model/prompt_version/created_at are immutable'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Attach the triggers. DROP IF EXISTS first so this migration is idempotent if
-- ever re-run against a partially-migrated database.
-- ---------------------------------------------------------------------------

-- Fully immutable: no UPDATE, no DELETE, no TRUNCATE.
DROP TRIGGER IF EXISTS dreams_no_mutate ON dreams;
CREATE TRIGGER dreams_no_mutate
  BEFORE UPDATE OR DELETE ON dreams
  FOR EACH ROW EXECUTE FUNCTION rehm_reject_write();
DROP TRIGGER IF EXISTS dreams_no_truncate ON dreams;
CREATE TRIGGER dreams_no_truncate
  BEFORE TRUNCATE ON dreams
  FOR EACH STATEMENT EXECUTE FUNCTION rehm_reject_truncate();

DROP TRIGGER IF EXISTS trend_runs_no_mutate ON trend_runs;
CREATE TRIGGER trend_runs_no_mutate
  BEFORE UPDATE OR DELETE ON trend_runs
  FOR EACH ROW EXECUTE FUNCTION rehm_reject_write();
DROP TRIGGER IF EXISTS trend_runs_no_truncate ON trend_runs;
CREATE TRIGGER trend_runs_no_truncate
  BEFORE TRUNCATE ON trend_runs
  FOR EACH STATEMENT EXECUTE FUNCTION rehm_reject_truncate();

DROP TRIGGER IF EXISTS restatement_turns_no_mutate ON restatement_turns;
CREATE TRIGGER restatement_turns_no_mutate
  BEFORE UPDATE OR DELETE ON restatement_turns
  FOR EACH ROW EXECUTE FUNCTION rehm_reject_write();
DROP TRIGGER IF EXISTS restatement_turns_no_truncate ON restatement_turns;
CREATE TRIGGER restatement_turns_no_truncate
  BEFORE TRUNCATE ON restatement_turns
  FOR EACH STATEMENT EXECUTE FUNCTION rehm_reject_truncate();

-- restatements: no DELETE, no TRUNCATE; UPDATE restricted to mutable columns.
DROP TRIGGER IF EXISTS restatements_no_delete ON restatements;
CREATE TRIGGER restatements_no_delete
  BEFORE DELETE ON restatements
  FOR EACH ROW EXECUTE FUNCTION rehm_reject_delete();
DROP TRIGGER IF EXISTS restatements_no_truncate ON restatements;
CREATE TRIGGER restatements_no_truncate
  BEFORE TRUNCATE ON restatements
  FOR EACH STATEMENT EXECUTE FUNCTION rehm_reject_truncate();
DROP TRIGGER IF EXISTS restatements_guard_update ON restatements;
CREATE TRIGGER restatements_guard_update
  BEFORE UPDATE ON restatements
  FOR EACH ROW EXECUTE FUNCTION rehm_restatements_guard_update();

-- No UPDATE (DELETE allowed as the re-derive/purge path).
DROP TRIGGER IF EXISTS analyses_no_update ON analyses;
CREATE TRIGGER analyses_no_update
  BEFORE UPDATE ON analyses
  FOR EACH ROW EXECUTE FUNCTION rehm_reject_update();

DROP TRIGGER IF EXISTS trend_claims_no_update ON trend_claims;
CREATE TRIGGER trend_claims_no_update
  BEFORE UPDATE ON trend_claims
  FOR EACH ROW EXECUTE FUNCTION rehm_reject_update();

DROP TRIGGER IF EXISTS concepts_no_update ON concepts;
CREATE TRIGGER concepts_no_update
  BEFORE UPDATE ON concepts
  FOR EACH ROW EXECUTE FUNCTION rehm_reject_update();

DROP TRIGGER IF EXISTS tagging_runs_no_update ON tagging_runs;
CREATE TRIGGER tagging_runs_no_update
  BEFORE UPDATE ON tagging_runs
  FOR EACH ROW EXECUTE FUNCTION rehm_reject_update();

DROP TRIGGER IF EXISTS taggings_no_update ON taggings;
CREATE TRIGGER taggings_no_update
  BEFORE UPDATE ON taggings
  FOR EACH ROW EXECUTE FUNCTION rehm_reject_update();

-- Record this migration so the runner / route won't reapply it.
INSERT INTO schema_migrations (version)
VALUES ('0007_immutability_triggers.sql')
ON CONFLICT (version) DO NOTHING;
