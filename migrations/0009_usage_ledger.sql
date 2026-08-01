-- rehm — Milestone: persistent usage ledger
--
-- Apply after 0008 (auto-applied on deploy; no manual step).
--
-- Token usage is real money spent on the user's own Anthropic key. Until now it
-- was only ever stored on the generated rows (restatements/analyses/trend_runs),
-- so deleting a dream also erased its recorded spend — the usage total dropped
-- as if the calls had never been billed. That is wrong: the money was spent.
--
-- usage_events is an append-only, immutable ledger of every billed call, keyed
-- to the user and NOT to any dream. Nothing cascades into it, and 0007-style
-- triggers forbid UPDATE/DELETE/TRUNCATE for every role — so a deleted dream
-- leaves the lifetime usage total exactly where it was. Per-dream token columns
-- stay for per-dream cost display; the Settings total now reads this ledger.

SELECT current_user AS applying_role;

CREATE TABLE usage_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users (id),
  kind          text NOT NULL CHECK (kind IN ('restatement', 'analysis', 'trend')),
  input_tokens  integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX usage_events_user_idx ON usage_events (user_id);

-- App role (inert, but keep the grant pattern auditable): read + append only.
REVOKE ALL ON usage_events FROM rehm_app;
GRANT SELECT, INSERT ON usage_events TO rehm_app;

-- Immutable spend record: no UPDATE, no DELETE, no TRUNCATE, for every role.
-- Reuses the reject functions defined in 0007.
DROP TRIGGER IF EXISTS usage_events_no_mutate ON usage_events;
CREATE TRIGGER usage_events_no_mutate
  BEFORE UPDATE OR DELETE ON usage_events
  FOR EACH ROW EXECUTE FUNCTION rehm_reject_write();
DROP TRIGGER IF EXISTS usage_events_no_truncate ON usage_events;
CREATE TRIGGER usage_events_no_truncate
  BEFORE TRUNCATE ON usage_events
  FOR EACH STATEMENT EXECUTE FUNCTION rehm_reject_truncate();

INSERT INTO schema_migrations (version)
VALUES ('0009_usage_ledger.sql')
ON CONFLICT (version) DO NOTHING;
