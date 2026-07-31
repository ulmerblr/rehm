# Migration owner role

All rehm migrations must be applied by a **single owner role** — the default
Neon role that owns the database. This is what keeps `ALTER DEFAULT PRIVILEGES`
(declared without `FOR ROLE` in `0002`) bound to one owner, so every
future owner-created table inherits the append-only grants for `rehm_app`.

## How it is enforced

- `0001_init.sql` records the applying role into the singleton table
  `migration_owner` (`owner_role = current_user`) on first apply.
- Every migration file begins with an assertion that raises and aborts if
  `current_user` does not match the pinned `migration_owner.owner_role`.
- Both migrations run `SELECT current_user AS applying_role` so the owner role
  is printed when you apply them.
- The Node runner (`npm run migrate`) refuses to run as anything but the pinned
  owner; `npm run verify` refuses to run as the owner.

The pin is captured from the database rather than hardcoded here, so it cannot
drift from or contradict the role that actually owns the objects.

## Recorded owner role

After applying `0001` as the owner, copy the printed `applying_role` here:

    owner role: __________________  (e.g. neondb_owner)

If a later migration ever aborts with "must be applied as pinned owner role",
you are connected as the wrong role — reconnect as the owner above.
