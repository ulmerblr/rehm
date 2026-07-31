// rehm append-only proof — VERIFY path. Run as the app role rehm_app.
//
//   npm run verify
//
// Point DATABASE_URL at the rehm_app connection string (a real connection, not
// SET ROLE from the owner — SET ROLE skips the connection/password path).
// Asserts current_user is rehm_app and NOT the pinned owner, then proves the
// append-only model. Applies nothing.

import { APP_ROLE, makeSql, readIdentity } from "./_shared.mjs";

async function main() {
  const sql = makeSql();
  const { currentUser, pinnedOwner } = await readIdentity(sql);

  if (pinnedOwner && currentUser === pinnedOwner) {
    console.error(
      `Refusing to verify as the owner "${currentUser}". Point DATABASE_URL ` +
        `at ${APP_ROLE} — the proof must run over a real app-role connection.`
    );
    process.exit(1);
  }
  if (currentUser !== APP_ROLE) {
    console.error(
      `Refusing to verify: current_user is "${currentUser}", expected ` +
        `${APP_ROLE}. Point DATABASE_URL at the ${APP_ROLE} connection string.`
    );
    process.exit(1);
  }

  await proveImmutability(sql);
}

async function proveImmutability(sql) {
  // Role hardening check (correction #1). A SQL-created role must not be a
  // superuser, must not bypass RLS, and must not be a member of neon_superuser
  // (which could reach tables it does not own and void the separation).
  console.log("--- rehm_app role hardening ---");
  try {
    const [role] = await sql`
      SELECT r.rolname, r.rolsuper, r.rolbypassrls,
             ARRAY(SELECT g.rolname FROM pg_auth_members m
                   JOIN pg_roles g ON g.oid = m.roleid
                   WHERE m.member = r.oid) AS memberof
      FROM pg_roles r WHERE r.rolname = 'rehm_app'
    `;
    if (!role) {
      console.log("WARN  rehm_app not found — apply 0002 as the owner first.");
    } else {
      const memberof = role.memberof ?? [];
      console.log(
        `      rolname=${role.rolname} rolsuper=${role.rolsuper} ` +
          `rolbypassrls=${role.rolbypassrls} memberof={${memberof.join(", ")}}`
      );
      if (role.rolsuper || role.rolbypassrls || memberof.includes("neon_superuser")) {
        console.log(
          "FAIL  rehm_app is over-privileged (superuser / bypassrls / " +
            "neon_superuser). Immutability guarantee is void — revoke and re-run."
        );
        process.exitCode = 1;
      } else {
        console.log("OK    rehm_app is not superuser, no bypassrls, no neon_superuser.");
      }
    }
  } catch (err) {
    console.log(`WARN  could not read role metadata: ${err.message}`);
  }

  // Writes that must be REJECTED. WHERE false guarantees no row is touched.
  console.log("\n--- writes that must be rejected ---");
  const rejected = [
    ["UPDATE dreams", "UPDATE dreams SET capture_method = capture_method WHERE false"],
    ["DELETE dreams", "DELETE FROM dreams WHERE false"],
    ["self-GRANT dreams", "GRANT UPDATE ON dreams TO CURRENT_USER"],
    ["UPDATE analyses", "UPDATE analyses SET body = body WHERE false"],
    ["DELETE trend_runs", "DELETE FROM trend_runs WHERE false"],
  ];
  for (const [label, stmt] of rejected) {
    try {
      await sql.query(stmt);
      console.log(`FAIL  ${label} was ALLOWED — append-only model is not in effect.`);
      process.exitCode = 1;
    } catch (err) {
      console.log(`OK    ${label} rejected: ${err.message}`);
    }
  }

  // INSERT into analyses must be ALLOWED. A random dream_id can't satisfy the
  // FK, so this trips a foreign_key_violation *after* the privilege check —
  // which proves INSERT is permitted without committing a junk row (dreams is
  // immutable, so a real test row could never be cleaned up).
  console.log("\n--- write that must be allowed ---");
  try {
    await sql.query(
      "INSERT INTO analyses (dream_id, model, prompt_version, blind) " +
        "VALUES (gen_random_uuid(), 'immutability-proof', 'immutability-proof', true)"
    );
    console.log("OK    INSERT into analyses committed (permitted).");
  } catch (err) {
    const denied =
      err.code === "42501" || /permission denied/i.test(err.message);
    if (denied) {
      console.log(`FAIL  INSERT into analyses denied: ${err.message}`);
      process.exitCode = 1;
    } else {
      console.log(
        `OK    INSERT into analyses permitted (reached constraint check, ` +
          `not blocked by privilege): ${err.message}`
      );
    }
  }
}

main().catch((err) => {
  console.error("verify failed:", err.message);
  process.exit(1);
});
