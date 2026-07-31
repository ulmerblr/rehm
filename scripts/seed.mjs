// rehm seed — shared logic. Imported by the server-side admin route
// (app/api/seed/route.ts); there is no local machine to run a CLI on.
//
// seedFromFiles(sql, seedDir) reads seedDir/manifest.json and the paired
// raw/NN.txt + restatements/NN.txt files VERBATIM (bytes read as-is and stored
// unchanged — no trimming, normalizing, or re-encoding) and inserts each dream
// and its restatement.
//
// Idempotency is DO NOTHING, never upsert (the app role has no UPDATE on
// dreams, so an upsert would fail at the database):
//   * dreams: INSERT ... ON CONFLICT (user_id, sequence_no) DO NOTHING.
//   * restatements: INSERT ... WHERE NOT EXISTS a restatement for the same
//     (dream_id, model, prompt_version) — so a re-run after a partial failure
//     neither duplicates nor skips a missing restatement.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value) {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const t = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(t);
}

export async function seedFromFiles(sql, seedDir) {
  const manifest = JSON.parse(
    readFileSync(join(seedDir, "manifest.json"), "utf8")
  );
  const { user_id, capture_method, restatement_model, restatement_prompt_version } =
    manifest;

  if (!UUID_RE.test(user_id ?? "")) {
    throw new Error(`manifest.user_id is not a valid uuid: ${user_id}`);
  }

  // dreams is append-only: every field is permanent, so validate the whole
  // manifest before inserting anything. dreamt_on is REQUIRED — a null date
  // permanently excludes the dream from month-over-month analysis and can
  // never be backfilled by the app.
  const undated = manifest.dreams
    .filter((d) => !validDate(d.dreamt_on))
    .map((d) => d.sequence_no);
  if (undated.length > 0) {
    throw new Error(
      `refusing to seed: dreamt_on missing or invalid (YYYY-MM-DD) for dream ` +
        `#${undated.join(", #")}`
    );
  }

  const results = [];
  let inserted = 0;
  let skipped = 0;

  for (const d of manifest.dreams) {
    const raw = readFileSync(join(seedDir, d.raw), "utf8");
    const restatement = readFileSync(join(seedDir, d.restatement), "utf8");

    const dreamRows = await sql`
      INSERT INTO dreams (user_id, sequence_no, dreamt_on, capture_method, raw_transcript)
      VALUES (${user_id}, ${d.sequence_no}, ${d.dreamt_on}, ${capture_method}, ${raw})
      ON CONFLICT (user_id, sequence_no) DO NOTHING
      RETURNING id
    `;

    let dreamId;
    if (dreamRows.length > 0) {
      dreamId = dreamRows[0].id;
      inserted += 1;
    } else {
      // Dream already present (idempotent re-run) — fetch its id so a missing
      // restatement can still be recovered.
      const existing = await sql`
        SELECT id FROM dreams
        WHERE user_id = ${user_id} AND sequence_no = ${d.sequence_no}
      `;
      dreamId = existing[0].id;
      skipped += 1;
    }

    // Insert the restatement only if none exists for this dream + model +
    // prompt_version (import idempotency without an upsert).
    const restatementRows = await sql`
      INSERT INTO restatements (dream_id, body, model, prompt_version)
      SELECT ${dreamId}, ${restatement}, ${restatement_model}, ${restatement_prompt_version}
      WHERE NOT EXISTS (
        SELECT 1 FROM restatements
        WHERE dream_id = ${dreamId}
          AND model = ${restatement_model}
          AND prompt_version = ${restatement_prompt_version}
      )
      RETURNING id
    `;

    results.push({
      sequence_no: d.sequence_no,
      dream_id: dreamId,
      dream_inserted: dreamRows.length > 0,
      restatement_inserted: restatementRows.length > 0,
    });
  }

  return { inserted, skipped, dreams: results };
}
