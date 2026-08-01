-- rehm — Milestone: rate-limit signup by IP
--
-- Apply in the Neon SQL editor as the OWNER role, after 0005.

-- (owner-pin assertion removed: single Vercel-managed owner, so it guarded
-- nothing and could not be planned on an empty DB. DB-level immutability is
-- enforced by the triggers in 0007, which fire for every role.)

SELECT current_user AS applying_role;

-- One row per signup POST, used to throttle attempts per IP.
CREATE TABLE signup_attempts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip         text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX signup_attempts_ip_time_idx ON signup_attempts (ip, created_at);

-- App needs to insert an attempt, count recent attempts, and prune old rows.
GRANT SELECT, INSERT, DELETE ON signup_attempts TO rehm_app;

INSERT INTO schema_migrations (version)
VALUES ('0006_signup_attempts.sql')
ON CONFLICT (version) DO NOTHING;
