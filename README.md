# rehm

A longitudinal dream study. A spoken dream is captured as raw text; a
restatement and an analysis are generated **independently** from that raw text
(siblings, never chained). Periodic trend runs read the whole corpus. Raw
transcripts are the immutable primary record.

## Stack

- Next.js (App Router, TypeScript), deployed on Vercel (auto-deploy on `main`)
- Neon Postgres, read via `process.env.DATABASE_URL`

## Database migrations

SQL migrations live in `migrations/`, applied **as the owner role** in the Neon
SQL editor (run `0001` then `0002`), or via `npm run migrate` with the owner
credential. See `migrations/OWNER_ROLE.md` for the owner-pin mechanism.

- `npm run migrate` — apply pending migrations. Runs as the **owner**; refuses
  to run as `rehm_app`.
- `npm run verify` — prove the append-only model. Runs as **`rehm_app`** over a
  real connection; refuses to run as the owner.

## What "immutable" means here

The immutability guarantee is about the **running application**, not the
database as a whole:

- **`dreams` — genuinely append-only for the app role.** `rehm_app` has
  `SELECT, INSERT` only: no `UPDATE`, no `DELETE`, ever. A raw transcript can
  never be edited or removed by the application.
- **`trend_runs` — versioned, app-append-only.** `rehm_app` has `SELECT,
  INSERT` only (no `DELETE`, no `UPDATE`). A trend run must stay readable so an
  old hypothesis can be scored when new dreams arrive, rather than quietly
  revised. Purging a bad run is a deliberate owner-credential operation; the
  `ON DELETE CASCADE` to `trend_claims` applies only to that owner purge.
- **Other derived tables (`restatements`, `analyses`, `trend_claims`,
  `concepts`, `tagging_runs`, `taggings`) — no in-place edit.** `rehm_app` has
  `SELECT, INSERT, DELETE` but **no `UPDATE`**. A record cannot be revised in
  place; a `DELETE` + `INSERT` can reproduce the effect of an edit. This is
  deliberate — purging a bad run is discarding a record, not revising one.
  Deleting a `tagging_run` cascades to its `taggings`; nothing cascades to
  `dreams`.
- **Control tables (`schema_migrations`, `migration_owner`) — unreachable by
  the app.** `rehm_app` holds no privilege on them. Note: default privileges on
  schema `public` grant `SELECT/INSERT/DELETE` to `rehm_app` for **new** tables,
  so any future control table **must carry its own `REVOKE ALL … FROM rehm_app`**
  in the migration that creates it.
- **The owner credential can undo any of this.** The owner owns the tables and
  can re-grant privileges or edit any row. Immutability holds because the owner
  credential is used only for migrations and is never present in the app
  runtime environment (`DATABASE_URL` points at `rehm_app`).
