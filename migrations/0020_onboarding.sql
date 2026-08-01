-- rehm — Milestone: first-run setup
--
-- Apply after 0019 (auto-applied on deploy; no manual step).
--
-- Two things have to be settled before a new account records anything, and
-- until now neither was asked for:
--
--   Language, because it decides what gets MADE. A dream captured before the
--   account says "Spanish" is dictated with an English recognizer and analysed
--   in English — and the raw transcript is immutable, so that is not something
--   a later setting can repair.
--
--   An API key, because without one nothing generates: no restatement, no
--   analysis, no title, no trend pass. The dream still saves, which is the
--   worst version of the problem — it looks like it worked.
--
-- onboarded_at records that the setup screen has been answered. It is not the
-- same as "has a key": someone may legitimately finish setup and go create a
-- key afterwards, and they must not be trapped on the way back in.

SELECT current_user AS applying_role;

ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;

-- Anyone already using the app has, by definition, been through this. Marking
-- them complete keeps existing accounts out of a setup screen that would tell
-- them nothing — the alternative is bouncing a working account to a form the
-- day this deploys.
UPDATE users u
SET onboarded_at = now()
WHERE u.onboarded_at IS NULL
  AND (
    EXISTS (SELECT 1 FROM user_api_keys k WHERE k.user_id = u.id AND k.status = 'active')
    OR EXISTS (SELECT 1 FROM dreams d WHERE d.user_id = u.id)
  );

INSERT INTO schema_migrations (version)
VALUES ('0020_onboarding.sql')
ON CONFLICT (version) DO NOTHING;
