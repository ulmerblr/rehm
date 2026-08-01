-- rehm — Milestone: paying for someone else's calls
--
-- Apply after 0022 (auto-applied on deploy; no manual step).
--
-- Bring-your-own-key is the right default: whoever generates the text pays for
-- it, and no key here can spend anyone else's money by accident. But some of
-- the people worth inviting will never set up an Anthropic account, and the
-- honest answer for them is not a worse product — it is somebody volunteering
-- to pay. key_sponsor_id records exactly that: this account's calls go on that
-- account's key, until whoever offered turns it off.
--
-- Nothing about the key itself changes. It stays encrypted, it is still only
-- decrypted inside the request that makes the call, and it is never shown to
-- the account spending it. What is granted is use, not possession.
--
-- ON DELETE SET NULL: erasing the sponsor must not erase the sponsored
-- account. It stops being sponsored, which is the truth once the key it was
-- billing to is gone.

SELECT current_user AS applying_role;

ALTER TABLE users ADD COLUMN IF NOT EXISTS key_sponsor_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass AND conname = 'users_key_sponsor_fkey'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_key_sponsor_fkey
      FOREIGN KEY (key_sponsor_id) REFERENCES users (id) ON DELETE SET NULL;
  END IF;
END $$;

-- Nobody sponsors themselves: that is what an unsponsored account already is,
-- and allowing it would make "is this account sponsored" two questions.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass AND conname = 'users_key_sponsor_not_self'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_key_sponsor_not_self
      CHECK (key_sponsor_id IS NULL OR key_sponsor_id <> id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS users_key_sponsor_idx ON users (key_sponsor_id);

-- Which account's key actually paid. From here on every row carries the real
-- payer, equal to user_id when the account paid for itself — so there is one
-- representation of the fact, not two. NULL therefore means only "written
-- before this migration", when the payer was always the account itself. No
-- backfill: reading it as user_id where NULL is correct and costs nothing.
--
-- Deliberately NOT a foreign key. usage_events refuses UPDATE (0007/0021), and
-- an ON DELETE SET NULL is an UPDATE — the trigger would abort the delete of
-- any account that had ever sponsored anyone. A plain uuid keeps the ledger
-- honest about a payer who no longer has an account, which is the true state.
ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS billed_to uuid;

CREATE INDEX IF NOT EXISTS usage_events_billed_to_idx ON usage_events (billed_to)
  WHERE billed_to IS NOT NULL;

INSERT INTO schema_migrations (version)
VALUES ('0023_key_sponsors.sql')
ON CONFLICT (version) DO NOTHING;
