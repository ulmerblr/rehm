-- rehm — Milestone: canonical dream ordering
--
-- Apply in the Neon SQL editor as the OWNER role, after 0002.
--
-- Adds sequence_no to dreams: a canonical per-user ordinal independent of date
-- accuracy. File/capture order is known and exact; dreamt_on may be approximate
-- or shared between two dreams in a night, so ordering and trend citations
-- ("Dream Nine") key on sequence_no, not on sorting by dreamt_on.

-- (owner-pin assertion removed: single Vercel-managed owner, so it guarded
-- nothing and could not be planned on an empty DB. DB-level immutability is
-- enforced by the triggers in 0007, which fire for every role.)

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
