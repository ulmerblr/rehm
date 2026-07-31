-- rehm — Milestone: canonical dream ordering
--
-- Apply in the Neon SQL editor as the OWNER role, after 0002.
--
-- Adds sequence_no to dreams: a canonical per-user ordinal independent of date
-- accuracy. File/capture order is known and exact; dreamt_on may be approximate
-- or shared between two dreams in a night, so ordering and trend citations
-- ("Dream Nine") key on sequence_no, not on sorting by dreamt_on.

-- Owner-pin assertion (see migrations/OWNER_ROLE.md). Fails loud if applied by
-- any role other than the one that applied 0001.
DO $$
BEGIN
  IF to_regclass('public.migration_owner') IS NOT NULL
     AND EXISTS (SELECT 1 FROM migration_owner)
     AND current_user <> (SELECT owner_role FROM migration_owner) THEN
    RAISE EXCEPTION
      'migration must be applied as pinned owner role "%", but current_user is "%"',
      (SELECT owner_role FROM migration_owner), current_user;
  END IF;
END
$$;

SELECT current_user AS applying_role;

-- dreams is empty pre-seed, so a NOT NULL column with no default is safe.
ALTER TABLE dreams ADD COLUMN sequence_no integer NOT NULL;

-- Unique per user (not global): two users may each have a dream number 1.
ALTER TABLE dreams
  ADD CONSTRAINT dreams_user_sequence_no_uniq UNIQUE (user_id, sequence_no);

-- rehm_app already holds table-level INSERT on dreams, which covers the new
-- column; no grant change needed.

INSERT INTO schema_migrations (version)
VALUES ('0003_dreams_sequence_no.sql')
ON CONFLICT (version) DO NOTHING;
