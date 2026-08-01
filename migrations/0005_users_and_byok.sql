-- rehm — Milestone: multi-user native auth + bring-your-own-key
--
-- Apply in the Neon SQL editor as the OWNER role, after 0004.
--
-- NOTE: the user_id columns on dreams/trend_runs/concepts/tagging_runs become
-- real FKs to users.id. If you recorded any dreams under the old single-subject
-- id, delete them first (they have no owner user), or these ALTERs will fail.

-- (owner-pin assertion removed: single Vercel-managed owner, so it guarded
-- nothing and could not be planned on an empty DB. DB-level immutability is
-- enforced by the triggers in 0007, which fire for every role.)

SELECT current_user AS applying_role;

-- Users. Passwords are hashed (bcrypt) by the app and never recoverable.
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_uniq UNIQUE (email)
);

-- Per-user Anthropic API keys, encrypted at rest (AES-256-GCM). Never stored
-- or returned in plaintext. Rotation is replace: insert new active row, mark
-- old inactive. At most one active key per user.
CREATE TABLE user_api_keys (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users (id),
  ciphertext       bytea NOT NULL,
  iv               bytea NOT NULL,
  auth_tag         bytea NOT NULL,
  last_four        text NOT NULL,
  label            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  last_verified_at timestamptz,
  status           text NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'inactive'))
);
CREATE UNIQUE INDEX user_api_keys_one_active
  ON user_api_keys (user_id) WHERE status = 'active';

-- Make the subject columns real foreign keys to users.
ALTER TABLE dreams
  ADD CONSTRAINT dreams_user_fk FOREIGN KEY (user_id) REFERENCES users (id);
ALTER TABLE trend_runs
  ADD CONSTRAINT trend_runs_user_fk FOREIGN KEY (user_id) REFERENCES users (id);
ALTER TABLE concepts
  ADD CONSTRAINT concepts_user_fk FOREIGN KEY (user_id) REFERENCES users (id);
ALTER TABLE tagging_runs
  ADD CONSTRAINT tagging_runs_user_fk FOREIGN KEY (user_id) REFERENCES users (id);

-- Cost visibility: token counts on every generated row. Nullable (older rows,
-- if any, predate this). restatements accumulates across the loop's calls.
ALTER TABLE restatements ADD COLUMN input_tokens  integer;
ALTER TABLE restatements ADD COLUMN output_tokens integer;
ALTER TABLE analyses     ADD COLUMN input_tokens  integer;
ALTER TABLE analyses     ADD COLUMN output_tokens integer;
ALTER TABLE trend_runs   ADD COLUMN input_tokens  integer;
ALTER TABLE trend_runs   ADD COLUMN output_tokens integer;

-- Grants. users and user_api_keys were created by the owner, so the ALTER
-- DEFAULT PRIVILEGES from 0002 already granted rehm_app SELECT/INSERT/DELETE on
-- them. Reset and grant exactly what the app needs.
REVOKE ALL ON users FROM rehm_app;
GRANT SELECT, INSERT ON users TO rehm_app;             -- login reads, signup inserts; never delete

REVOKE ALL ON user_api_keys FROM rehm_app;
GRANT SELECT, INSERT ON user_api_keys TO rehm_app;     -- add a key; read metadata
GRANT UPDATE (status, last_verified_at) ON user_api_keys TO rehm_app; -- rotate / mark verified

-- Token accumulation across the restatement loop (metadata only, not content).
GRANT UPDATE (input_tokens, output_tokens) ON restatements TO rehm_app;

-- Record this migration so the Node runner won't reapply it.
INSERT INTO schema_migrations (version)
VALUES ('0005_users_and_byok.sql')
ON CONFLICT (version) DO NOTHING;
