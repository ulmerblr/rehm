// rehm migration runner — APPLY path. Run as the OWNER role.
//
//   npm run migrate
//
// Point DATABASE_URL at the OWNER connection string. Asserts current_user is
// the owner (and never rehm_app), applies each migrations/*.sql not yet in
// schema_migrations, atomically, in filename order. Each file records its own
// schema_migrations row, so nothing is appended here and applied files are
// never reapplied. The proof lives in `npm run verify` (run as rehm_app).
//
// Normally migrations are applied in the Neon SQL editor as the owner; this
// runner is the scripted equivalent and requires the owner credential.

import {
  APP_ROLE,
  makeSql,
  readIdentity,
  splitStatements,
  migrationFiles,
  readMigration,
} from "./_shared.mjs";

async function main() {
  const sql = makeSql();
  const { currentUser, pinnedOwner } = await readIdentity(sql);

  if (currentUser === APP_ROLE) {
    console.error(
      `Refusing to migrate as ${APP_ROLE}. Point DATABASE_URL at the owner ` +
        "credential (migrations create tables/roles the app role cannot)."
    );
    process.exit(1);
  }
  if (pinnedOwner && currentUser !== pinnedOwner) {
    console.error(
      `Refusing to migrate: current_user is "${currentUser}" but the pinned ` +
        `owner is "${pinnedOwner}" (migrations/OWNER_ROLE.md).`
    );
    process.exit(1);
  }
  console.log(`Applying as owner role: ${currentUser}`);

  // Bootstrap the ledger so we can read applied versions (0001 also creates it).
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  const applied = new Set(
    (await sql`SELECT version FROM schema_migrations`).map((r) => r.version)
  );
  const files = migrationFiles();
  const pending = files.filter((f) => !applied.has(f));

  for (const file of files) {
    if (!pending.includes(file)) console.log(`applied  ${file}`);
  }

  for (const file of pending) {
    const statements = splitStatements(readMigration(file));
    try {
      // Each file records its own schema_migrations row; nothing appended here.
      await sql.transaction(statements.map((s) => sql.query(s)));
      console.log(`apply    ${file} (${statements.length} statements)`);
    } catch (err) {
      console.error(`\nFailed applying ${file}: ${err.message}`);
      process.exit(1);
    }
  }

  console.log(
    pending.length === 0
      ? "All migrations recorded."
      : `Applied ${pending.length} migration(s).`
  );
  console.log("Run `npm run verify` as rehm_app to prove the append-only model.");
}

main().catch((err) => {
  console.error("migrate failed:", err.message);
  process.exit(1);
});
