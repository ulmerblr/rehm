-- rehm — Milestone: dual-language accounts
--
-- Apply after 0017 (auto-applied on deploy; no manual step).
--
-- Two people share this app across two languages. She logs dreams in Spanish;
-- he reads in English. The rule the whole design turns on:
--
--     THE ACCOUNT LANGUAGE DECIDES WHAT GETS MADE.
--     THE VIEW TOGGLE DECIDES WHAT GETS SHOWN.
--
-- So a Spanish account dictates in Spanish, restates in Spanish, and analyses
-- in Spanish — permanently, whatever the screen happens to be showing. Flipping
-- the view to English changes nothing about the corpus.
--
-- Translations are DISPLAY ONLY. Nothing downstream may read one: restatement,
-- analysis, and trend passes all read the raw transcript in the language it was
-- spoken. The no-chaining rule protects the derivation pipeline; rendering the
-- same text in another language for a human to read is not derivation. If a
-- translation ever became an input, the corpus would start recording the
-- translator's word choices instead of the dreamer's, and longitudinal
-- recurrence — the entire point — would be measuring the wrong thing.
--
-- Cost is paid once, when the text is made, and never again. A toggle is free
-- forever after.

SELECT current_user AS applying_role;

-- Account language + whether this account prepares both. Default single: a
-- monolingual user must never pay for a second language they'll never read.
ALTER TABLE users ADD COLUMN IF NOT EXISTS language      text NOT NULL DEFAULT 'en';
ALTER TABLE users ADD COLUMN IF NOT EXISTS dual_language boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass AND conname = 'users_language_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_language_check
      CHECK (language IN ('en', 'es'));
  END IF;
END $$;

-- One row per (piece of text, target language). source_type/source_id is a
-- loose reference rather than a foreign key because the sources live in six
-- different tables; the delete path below keeps it honest.
--
-- Immutable like analyses: a translation is a derived artifact, written once.
-- A better translation is a new row after the old one is deleted, not an edit.
CREATE TABLE IF NOT EXISTS translations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users (id),
  source_type   text NOT NULL CHECK (source_type IN (
                    'dream', 'addendum', 'title', 'restatement',
                    'analysis', 'trend_closing', 'trend_claim')),
  source_id     uuid NOT NULL,
  target_lang   text NOT NULL CHECK (target_lang IN ('en', 'es')),
  body          text NOT NULL,
  model         text NOT NULL,
  input_tokens  integer,
  output_tokens integer,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT translations_source_uniq UNIQUE (source_type, source_id, target_lang)
);
CREATE INDEX IF NOT EXISTS translations_lookup_idx
  ON translations (user_id, target_lang, source_type);

-- Read, append, and delete: delete is needed so a deleted dream doesn't leave
-- orphaned translations behind (there is no cascade — the sources are spread
-- across six tables). UPDATE is withheld deliberately.
REVOKE ALL ON translations FROM rehm_app;
GRANT SELECT, INSERT, DELETE ON translations TO rehm_app;

-- No UPDATE, for every role including the owner. DELETE stays legal so the
-- 0008 gated-delete path can clean up after a dream.
DROP TRIGGER IF EXISTS translations_no_update ON translations;
CREATE TRIGGER translations_no_update
  BEFORE UPDATE ON translations
  FOR EACH ROW EXECUTE FUNCTION rehm_reject_update();

-- Backfill state: turning dual language on translates everything already
-- logged. Working state, so mutable and trigger-free, exactly like trend_jobs.
CREATE TABLE IF NOT EXISTS translation_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users (id),
  target_lang   text NOT NULL CHECK (target_lang IN ('en', 'es')),
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'done', 'failed', 'canceled')),
  total_items   integer NOT NULL DEFAULT 0,
  done_items    integer NOT NULL DEFAULT 0,
  failed_items  integer NOT NULL DEFAULT 0,
  error         text,
  input_tokens  integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS translation_jobs_user_idx
  ON translation_jobs (user_id, created_at DESC);

REVOKE ALL ON translation_jobs FROM rehm_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON translation_jobs TO rehm_app;

-- Widen usage_events.kind to allow 'translation'. Same shape as 0011: find the
-- constraint by definition rather than by a guessed name.
DO $$
DECLARE cname text;
BEGIN
  IF to_regclass('public.usage_events') IS NULL THEN
    RETURN;
  END IF;

  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.usage_events'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%kind%';

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE usage_events DROP CONSTRAINT %I', cname);
  END IF;

  ALTER TABLE usage_events
    ADD CONSTRAINT usage_events_kind_check
    CHECK (kind IN ('restatement', 'analysis', 'trend', 'title', 'translation'));
END $$;

INSERT INTO schema_migrations (version)
VALUES ('0018_languages.sql')
ON CONFLICT (version) DO NOTHING;
