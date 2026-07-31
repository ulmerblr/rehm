# rehm

A longitudinal dream study. A spoken dream is captured as raw text; a
restatement and an analysis are generated **independently** from that raw text
(siblings, never chained). Periodic trend runs read the whole corpus. Raw
transcripts are the immutable primary record.

## Stack

- Next.js (App Router, TypeScript), deployed on Vercel (auto-deploy on `main`)
- Neon Postgres, read via `process.env.DATABASE_URL`
- Claude (`claude-opus-5`) via `@anthropic-ai/sdk`, server-side only

## Environment variables (Vercel)

- `DATABASE_URL` — the **`rehm_app`** connection string (SELECT/INSERT-scoped app role)
- `ANTHROPIC_API_KEY` — server-side only; never shipped to the client
- `VIEW_TOKEN` — the shared access token that gates the whole site (see Access gating)

## The app

- **`/`** — dreams by `sequence_no` (date + first line), plus "Record a dream".
- **`/record`** — capture (Web Speech dictation, textarea fallback) → the
  restatement loop → done.
- **`/dreams/[id]`** — raw transcript, accepted restatement, the loop turns
  (collapsed), analyses, "Run analysis", and Export.
- **`/trends`** — run a trend pass, list past runs, claims rendered with links
  to the dreams they cite.

### The restatement loop

The machine proposes a restatement of the raw transcript. **Agree** locks it
(`accepted = true`, `accepted_at` set). **Disagree** opens a box for what it got
wrong; that objection is stored as a turn and a new proposal is generated from
the raw transcript **plus all prior turns**. Loop until Agree — no other exits,
no hand-editing the proposal. Every proposal and every objection is stored in
`restatement_turns`, in order, and persists after acceptance: the objections are
the dreamer's own emphasis at capture time.

### Analysis (blind) and trends

Analyses are generated from the raw transcript **only** — not the restatement,
not prior dreams, not prior analyses, not any theme vocabulary — and stored with
`blind = true`, a new row per run. Trend runs read every raw transcript in one
pass, write a `trend_run` (stamped with `corpus_size`) plus `trend_claims`; every
claim must cite the dream ids it rests on (a claim without citations is dropped,
and the DB CHECK enforces non-empty). Prior trend runs are kept, never
overwritten.

### The wall

No chat anywhere. Nothing the app generates is input to anything else it
generates, **except** the restatement-loop turns feeding the next proposal.
Every dream and every trend run has an Export button that copies the whole thing
as plain text for pasting into any LLM to continue elsewhere.

### Prompts

Prompt text lives in `lib/prompts.ts` with a version string per prompt; every
generated row stores `model` + `prompt_version` so a run is reproducible.

## Database migrations

SQL migrations live in `migrations/`, applied **as the owner role** in the Neon
SQL editor (run them in order), or via `npm run migrate` with the owner
credential. See `migrations/OWNER_ROLE.md` for the owner-pin mechanism.

- `npm run migrate` — apply pending migrations. Runs as the **owner**; refuses
  to run as `rehm_app`.
- `npm run verify` — prove the append-only model. Runs as **`rehm_app`**.

## Subject identity

`dreams.user_id` (and `user_id` on `trend_runs`, `concepts`, `tagging_runs`) is
a **permanent study-subject id**, decoupled from authentication (`lib/config.ts`
→ `SUBJECT_ID`). When native login and hub SSO arrive, the SSO/login identity
maps to a subject id **at the application layer** — `dreams.user_id` is the
subject, not the login.

## Access gating

These are private dream transcripts: **no route serves `raw_transcript`
unauthenticated, ever** — including preview deploys. Until native auth lands, the
whole app sits behind a single shared `VIEW_TOKEN`, entered once at `/login` and
exchanged for a signed, httpOnly session cookie. `middleware.ts` verifies the
cookie on every request (server-side only, no client-side redirect gating). When
SSO lands it **replaces** this gate; it does not run as a second path alongside.

## What "immutable" means here

The immutability guarantee is about the **running application**, not the
database as a whole:

- **`dreams` — genuinely append-only for the app role.** `rehm_app` has
  `SELECT, INSERT` only: no `UPDATE`, no `DELETE`, ever.
- **`trend_runs` — versioned, app-append-only.** `SELECT, INSERT` only — a run
  must stay readable so an old hypothesis can be scored, not silently revised.
- **`restatement_turns` — append-only.** `SELECT, INSERT` only: the record of
  what was proposed and objected to is never rewritten.
- **`restatements`** — `SELECT, INSERT`, plus `UPDATE` on the `accepted` /
  `accepted_at` columns only (column-level); `body`/`model`/`prompt_version`
  stay immutable.
- **Other derived tables** (`restatements` body aside, `analyses`,
  `trend_claims`, `concepts`, `taggings`, `tagging_runs`) — `SELECT, INSERT,
  DELETE`, **no `UPDATE`**: no in-place edit; a `DELETE` + `INSERT` can reproduce
  one. Deleting a `trend_run`/`tagging_run` cascades to its claims/taggings;
  nothing cascades to `dreams`.
- **Control tables** (`schema_migrations`, `migration_owner`) — unreachable by
  the app. Any future control table must carry its own `REVOKE ALL … FROM
  rehm_app`.
- **The owner credential can undo any of this.** Immutability holds because the
  owner credential is used only for migrations and is never in the app runtime
  environment.
