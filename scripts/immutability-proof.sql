-- rehm — dreams / append-only immutability proof
--
-- Run this as a REAL rehm_app connection, not `SET ROLE` from the owner
-- (SET ROLE skips the connection/password path). Two ways:
--   * Neon SQL editor with the role selector set to rehm_app, or
--   * npm run migrate  with DATABASE_URL pointing at rehm_app.
-- Expected results are noted per statement.

-- Role hardening (correction #1): expect rolsuper = f, rolbypassrls = f, and
-- memberof empty (in particular NO neon_superuser). If neon_superuser appears,
-- the guarantee is void — as the owner run  REVOKE neon_superuser FROM rehm_app;
-- and re-run this proof.
SELECT r.rolname, r.rolsuper, r.rolbypassrls,
       ARRAY(SELECT g.rolname FROM pg_auth_members m
             JOIN pg_roles g ON g.oid = m.roleid
             WHERE m.member = r.oid) AS memberof
FROM pg_roles r WHERE r.rolname = 'rehm_app';

-- dreams is immutable: expect "permission denied for table dreams".
UPDATE dreams SET capture_method = capture_method WHERE false;

-- expect "permission denied for table dreams".
DELETE FROM dreams WHERE false;

-- expect permission denied (must be owner of table dreams) — rehm_app cannot
-- grant itself the privilege.
GRANT UPDATE ON dreams TO CURRENT_USER;

-- derived tables are append-only: expect "permission denied for table analyses".
UPDATE analyses SET body = body WHERE false;

-- INSERT is allowed: expect a foreign_key_violation on dream_id (the statement
-- passed the privilege check), NOT permission denied. A random uuid can't match
-- a real dream, so nothing is committed.
INSERT INTO analyses (dream_id, model, prompt_version, blind)
VALUES (gen_random_uuid(), 'immutability-proof', 'immutability-proof', true);
