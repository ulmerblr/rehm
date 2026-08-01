-- rehm — Milestone: trend closing synthesis + recorded dream numbers
--
-- Apply after 0012 (auto-applied on deploy; no manual step).
--
-- Two additions to trend_runs:
--
--   closing       A final synthesis. A run used to open with a summary and then
--                 list parallel claims with no conclusion — it read as "this is
--                 similar, this is similar" and stopped. The closing says what
--                 the claims add up to taken together.
--
--   dream_numbers The sequence numbers actually read in the pass. The scope
--                 alone can't reconstruct this later: "last 2 dreams" means a
--                 different pair once more dreams are recorded, and trend_runs
--                 is immutable, so the membership is captured at INSERT.
--
-- ADD COLUMN is DDL, so the 0007 row triggers do not fire. Both columns are
-- nullable: runs recorded before this migration have neither, and the UI falls
-- back to the scope label for those.

SELECT current_user AS applying_role;

ALTER TABLE trend_runs ADD COLUMN IF NOT EXISTS closing       text;
ALTER TABLE trend_runs ADD COLUMN IF NOT EXISTS dream_numbers integer[];

INSERT INTO schema_migrations (version)
VALUES ('0013_trend_closing.sql')
ON CONFLICT (version) DO NOTHING;
