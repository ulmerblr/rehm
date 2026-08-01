-- rehm — Milestone: who brought whom
--
-- Apply after 0021 (auto-applied on deploy; no manual step).
--
-- The lineage was already implied: invites.created_by is who issued a code and
-- invites.used_by is who redeemed it, so joining the two answered "who invited
-- this person". That answer stopped being durable in 0021's follow-up, which
-- added the ability to delete an invitation row — a tidy-up of the invitations
-- list would quietly erase the fact that one account brought another.
--
-- So the fact moves onto the account itself, where it belongs. invites stays
-- working state that can be cleaned up freely; users.invited_by is the record.
--
-- ON DELETE SET NULL, not CASCADE: erasing an inviter must not erase the
-- people they invited. Those accounts simply stop having a recorded referrer,
-- which is the truth once the referrer no longer exists.

SELECT current_user AS applying_role;

ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass AND conname = 'users_invited_by_fkey'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_invited_by_fkey
      FOREIGN KEY (invited_by) REFERENCES users (id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS users_invited_by_idx ON users (invited_by);

-- Backfill from the invitations still on file. Anyone who signed up on the
-- committed word rather than an invitation has no referrer, correctly.
UPDATE users u
SET invited_by = i.created_by
FROM invites i
WHERE i.used_by = u.id
  AND u.invited_by IS NULL
  AND i.created_by <> u.id;

INSERT INTO schema_migrations (version)
VALUES ('0022_invited_by.sql')
ON CONFLICT (version) DO NOTHING;
