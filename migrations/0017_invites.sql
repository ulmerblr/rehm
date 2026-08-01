-- rehm — Milestone: single-use invitations
--
-- Apply after 0016 (auto-applied on deploy; no manual step).
--
-- Signup used one shared word committed in the source. That was fine for a
-- handful of friends but it can't be revoked, can't be traced, and can't be
-- retired once it has been forwarded on. An invitation is now a single-use
-- code: issued by a signed-in user, redeemable exactly once, revocable until
-- it is.
--
-- This table is working state, not the record — used_at and revoked_at have to
-- be writable — so it carries no immutability triggers.

SELECT current_user AS applying_role;

CREATE TABLE IF NOT EXISTS invites (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code       text NOT NULL,
  created_by uuid NOT NULL REFERENCES users (id),
  label      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at    timestamptz,
  used_by    uuid REFERENCES users (id),
  revoked_at timestamptz,
  CONSTRAINT invites_code_uniq UNIQUE (code)
);
CREATE INDEX IF NOT EXISTS invites_creator_idx ON invites (created_by, created_at DESC);

REVOKE ALL ON invites FROM rehm_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON invites TO rehm_app;

INSERT INTO schema_migrations (version)
VALUES ('0017_invites.sql')
ON CONFLICT (version) DO NOTHING;
