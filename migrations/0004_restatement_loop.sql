-- rehm — Milestone: the restatement loop
--
-- Apply in the Neon SQL editor as the OWNER role, after 0003.
--
-- Adds acceptance state to restatements and a restatement_turns table that
-- records every proposal and every objection, in order. The objections are the
-- dreamer's own emphasis at capture time and persist after acceptance.

-- (owner-pin assertion removed: single Vercel-managed owner, so it guarded
-- nothing and could not be planned on an empty DB. DB-level immutability is
-- enforced by the triggers in 0007, which fire for every role.)

SELECT current_user AS applying_role;

-- Acceptance state on restatements. body/model/prompt_version stay immutable
-- for the app role (0002); only these two columns become app-updatable below.
ALTER TABLE restatements ADD COLUMN accepted     boolean NOT NULL DEFAULT false;
ALTER TABLE restatements ADD COLUMN accepted_at  timestamptz;

-- The negotiation record: proposals and objections, in order, per restatement.
CREATE TABLE restatement_turns (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restatement_id uuid NOT NULL REFERENCES restatements (id) ON DELETE CASCADE,
  turn_no        integer NOT NULL,
  role           text NOT NULL CHECK (role IN ('proposal', 'objection')),
  body           text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT restatement_turns_order_uniq UNIQUE (restatement_id, turn_no)
);
CREATE INDEX restatement_turns_restatement_idx
  ON restatement_turns (restatement_id, turn_no);

-- Grants for the app role.
--   restatement_turns: SELECT + INSERT only. Turns are append-only — never
--   UPDATE and never DELETE (the record of what was proposed and objected to
--   must not be rewritten).
GRANT SELECT, INSERT ON restatement_turns TO rehm_app;

--   restatements already has SELECT + INSERT (0002). Add UPDATE on the two
--   acceptance columns ONLY — column-level, not table-wide, so body/model/
--   prompt_version remain immutable for the app role.
GRANT UPDATE (accepted, accepted_at) ON restatements TO rehm_app;

-- Append-only stance: no UPDATE on restatement_turns.
REVOKE UPDATE ON restatement_turns FROM rehm_app;

-- Record this migration so the Node runner won't reapply it.
INSERT INTO schema_migrations (version)
VALUES ('0004_restatement_loop.sql')
ON CONFLICT (version) DO NOTHING;
