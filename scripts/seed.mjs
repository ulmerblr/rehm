// rehm seed — import 9 raw transcripts + 9 restatements. Run as rehm_app.
//
//   npm run seed
//
// Point DATABASE_URL at the rehm_app connection string. Reads seed/manifest.json
// and the paired seed/raw/NN.txt + seed/restatements/NN.txt files VERBATIM
// (bytes are read as-is and stored unchanged — no trimming, normalizing, or
// re-encoding), then inserts each dream and its restatement.
//
// Idempotent: a dream already present for (user_id, sequence_no) is skipped
// along with its restatement, so re-running does not duplicate rows. No LLM
// calls. Never prints the connection string.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { APP_ROLE, makeSql, readIdentity, repoRoot } from "./_shared.mjs";

const seedDir = join(repoRoot, "seed");
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function main() {
  const sql = makeSql();
  const { currentUser } = await readIdentity(sql);
  if (currentUser !== APP_ROLE) {
    console.error(
      `Refusing to seed: current_user is "${currentUser}", expected ` +
        `${APP_ROLE}. Point DATABASE_URL at the ${APP_ROLE} connection string.`
    );
    process.exit(1);
  }

  const manifest = JSON.parse(
    readFileSync(join(seedDir, "manifest.json"), "utf8")
  );
  const { user_id, capture_method, restatement_model, restatement_prompt_version } =
    manifest;

  if (!UUID_RE.test(user_id ?? "")) {
    console.error(`manifest.user_id is not a valid uuid: ${user_id}`);
    process.exit(1);
  }

  let inserted = 0;
  let skipped = 0;
  for (const d of manifest.dreams) {
    const existing = await sql`
      SELECT id FROM dreams
      WHERE user_id = ${user_id} AND sequence_no = ${d.sequence_no}
    `;
    if (existing.length > 0) {
      console.log(`skip   dream #${d.sequence_no} (already seeded)`);
      skipped += 1;
      continue;
    }

    // Read both files verbatim before inserting either.
    const raw = readFileSync(join(seedDir, d.raw), "utf8");
    const restatement = readFileSync(join(seedDir, d.restatement), "utf8");

    const [dream] = await sql`
      INSERT INTO dreams (user_id, sequence_no, dreamt_on, capture_method, raw_transcript)
      VALUES (${user_id}, ${d.sequence_no}, ${d.dreamt_on}, ${capture_method}, ${raw})
      RETURNING id
    `;
    await sql`
      INSERT INTO restatements (dream_id, body, model, prompt_version)
      VALUES (${dream.id}, ${restatement}, ${restatement_model}, ${restatement_prompt_version})
    `;
    console.log(`insert dream #${d.sequence_no} -> ${dream.id}`);
    inserted += 1;
  }

  console.log(`\nSeed complete: ${inserted} inserted, ${skipped} skipped.`);
}

main().catch((err) => {
  console.error("seed failed:", err.message);
  process.exit(1);
});
