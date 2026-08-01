-- rehm — Milestone: gated hard-delete of a dream
--
-- Apply after 0007 (Neon SQL editor as owner, the Node runner, or /api/migrate).
--
-- 0007 made dreams / restatements / restatement_turns immutable for EVERY role,
-- owner included: no UPDATE, no DELETE, no TRUNCATE. That is still the default.
-- This migration carves ONE deliberate exception so a user can destroy a dream
-- (e.g. a junk test recording) and everything derived from it.
--
-- The exception is not "owner may delete" — the app already runs as owner, so
-- that would be no guard at all. Instead DELETE is permitted only inside a
-- transaction that has explicitly opted in with:
--     SET LOCAL rehm.allow_delete = 'on';
-- SET LOCAL is transaction-scoped, so the opt-in evaporates at COMMIT. Every
-- normal write path, every migration, and every casual SQL session never sets
-- it, so the corpus stays immutable by default; only the dedicated delete route
-- (which sets the flag) can destroy. UPDATE and TRUNCATE remain fully blocked.

SELECT current_user AS applying_role;

-- DELETE guard: allow only when the current transaction opted in via
-- SET LOCAL rehm.allow_delete = 'on'. The second arg to current_setting is
-- missing_ok=true, so an unset flag reads as NULL (blocked) rather than error.
CREATE OR REPLACE FUNCTION rehm_guard_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('rehm.allow_delete', true) = 'on' THEN
    RETURN OLD;  -- deliberate, transaction-scoped deletion path
  END IF;
  RAISE EXCEPTION
    'DELETE on % is forbidden: rows here are immutable unless a transaction sets rehm.allow_delete = ''on''',
    TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$;

-- dreams: was UPDATE+DELETE via one rejecting trigger. Split so UPDATE stays
-- hard-blocked while DELETE goes through the opt-in guard. (TRUNCATE trigger
-- from 0007 is untouched — still hard-blocked.)
DROP TRIGGER IF EXISTS dreams_no_mutate ON dreams;
DROP TRIGGER IF EXISTS dreams_no_update ON dreams;
CREATE TRIGGER dreams_no_update
  BEFORE UPDATE ON dreams
  FOR EACH ROW EXECUTE FUNCTION rehm_reject_update();
DROP TRIGGER IF EXISTS dreams_no_delete ON dreams;
CREATE TRIGGER dreams_no_delete
  BEFORE DELETE ON dreams
  FOR EACH ROW EXECUTE FUNCTION rehm_guard_delete();

-- restatement_turns: same split. Turns cascade-delete from restatements
-- (ON DELETE CASCADE), which fires this BEFORE DELETE trigger, so the guard
-- must see the flag — it does, since the whole cascade runs in the one
-- opted-in transaction.
DROP TRIGGER IF EXISTS restatement_turns_no_mutate ON restatement_turns;
DROP TRIGGER IF EXISTS restatement_turns_no_update ON restatement_turns;
CREATE TRIGGER restatement_turns_no_update
  BEFORE UPDATE ON restatement_turns
  FOR EACH ROW EXECUTE FUNCTION rehm_reject_update();
DROP TRIGGER IF EXISTS restatement_turns_no_delete ON restatement_turns;
CREATE TRIGGER restatement_turns_no_delete
  BEFORE DELETE ON restatement_turns
  FOR EACH ROW EXECUTE FUNCTION rehm_guard_delete();

-- restatements: DELETE was hard-blocked; route it through the opt-in guard.
-- The column-level UPDATE guard (accepted/tokens only) and TRUNCATE block from
-- 0007 stay exactly as they were.
DROP TRIGGER IF EXISTS restatements_no_delete ON restatements;
CREATE TRIGGER restatements_no_delete
  BEFORE DELETE ON restatements
  FOR EACH ROW EXECUTE FUNCTION rehm_guard_delete();

-- trend_runs stays fully immutable (no delete path): deleting a dream scrubs
-- the dream from trend_claims but never removes a historical trend run.
-- analyses / trend_claims / concepts / tagging_runs / taggings already allow
-- DELETE (0007 blocks only their UPDATE), so no change is needed there.

INSERT INTO schema_migrations (version)
VALUES ('0008_gated_delete.sql')
ON CONFLICT (version) DO NOTHING;
