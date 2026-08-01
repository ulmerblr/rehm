-- rehm — Milestone: dream addenda ("I remembered something else")
--
-- Apply after 0013 (auto-applied on deploy; no manual step).
--
-- A dream's raw transcript is the immutable primary record and must never be
-- rewritten. But memory keeps working after capture: a detail surfaces hours or
-- days later. That is an ADDITION, not a correction — and its timing is itself
-- evidence. A detail recalled three days on is a different kind of claim from
-- one spoken at capture, so each addendum carries its own captured_at and its
-- own ordinal, and the original transcript is left exactly as spoken.
--
-- Same immutability stance as dreams: append-only, never updated, never
-- truncated. DELETE is permitted only through the gated path from 0008, which
-- is how a deleted dream cascades its addenda away inside the one opted-in
-- transaction.

SELECT current_user AS applying_role;

CREATE TABLE IF NOT EXISTS dream_addenda (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dream_id     uuid NOT NULL REFERENCES dreams (id) ON DELETE CASCADE,
  addendum_no  integer NOT NULL,
  body         text NOT NULL,
  captured_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dream_addenda_order_uniq UNIQUE (dream_id, addendum_no)
);
CREATE INDEX IF NOT EXISTS dream_addenda_dream_idx
  ON dream_addenda (dream_id, addendum_no);

-- Read + append only, exactly like dreams. No UPDATE, no DELETE for the app.
REVOKE ALL ON dream_addenda FROM rehm_app;
GRANT SELECT, INSERT ON dream_addenda TO rehm_app;

-- Immutable for every role, including the owner (0007 functions).
DROP TRIGGER IF EXISTS dream_addenda_no_update ON dream_addenda;
CREATE TRIGGER dream_addenda_no_update
  BEFORE UPDATE ON dream_addenda
  FOR EACH ROW EXECUTE FUNCTION rehm_reject_update();

DROP TRIGGER IF EXISTS dream_addenda_no_truncate ON dream_addenda;
CREATE TRIGGER dream_addenda_no_truncate
  BEFORE TRUNCATE ON dream_addenda
  FOR EACH STATEMENT EXECUTE FUNCTION rehm_reject_truncate();

-- DELETE only inside a transaction that opted in (0008) — this is what lets the
-- cascade from a deleted dream through.
DROP TRIGGER IF EXISTS dream_addenda_no_delete ON dream_addenda;
CREATE TRIGGER dream_addenda_no_delete
  BEFORE DELETE ON dream_addenda
  FOR EACH ROW EXECUTE FUNCTION rehm_guard_delete();

INSERT INTO schema_migrations (version)
VALUES ('0014_dream_addenda.sql')
ON CONFLICT (version) DO NOTHING;
