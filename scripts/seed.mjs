// rehm seed — shared logic. Imported by the server-side admin route
// (app/api/seed/route.ts); there is no local machine to run a CLI on.
//
// Byte fidelity is verified end to end because dreams is append-only and has no
// UPDATE path to repair a coercion:
//   Phase A  read each file as a raw Buffer, hash it, compare to the sha256 +
//            byte length recorded in the manifest. Abort the whole seed on any
//            mismatch before inserting anything.
//   Phase B  decode explicitly as utf8 at the insert boundary; insert each
//            dream and its restatement atomically (one transaction).
//   Phase C  SELECT the stored text back, re-encode to a Buffer, re-hash, and
//            compare to the manifest again. Report per-dream PASS/FAIL.
//
// Fail-closed: refuses (409) if any dreams row already exists for the subject —
// the corpus is seeded once, never appended. Idempotency is DO NOTHING, never
// upsert (the app role has no UPDATE on dreams).

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function validDate(value) {
  return (
    typeof value === "string" &&
    DATE_RE.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  );
}

function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export async function seedFromFiles(sql, seedDir) {
  const manifest = JSON.parse(
    readFileSync(join(seedDir, "manifest.json"), "utf8")
  );
  const { user_id, capture_method, restatement_model, restatement_prompt_version } =
    manifest;

  if (!UUID_RE.test(user_id ?? "")) {
    throw fail(422, `manifest.user_id is not a valid uuid: ${user_id}`);
  }

  // ----- Phase A: validate manifest + verify on-disk byte fidelity -----
  const prepared = [];
  const problems = [];
  for (const d of manifest.dreams) {
    if (!validDate(d.dreamt_on)) {
      problems.push(`#${d.sequence_no}: dreamt_on missing/invalid (YYYY-MM-DD)`);
      continue;
    }
    for (const side of ["raw", "restatement"]) {
      const expectedHash = d[`${side}_sha256`];
      const expectedBytes = d[`${side}_bytes`];
      if (!expectedHash || typeof expectedBytes !== "number") {
        problems.push(`#${d.sequence_no}: ${side}_sha256/${side}_bytes not recorded`);
      }
    }
    if (problems.length) continue;

    const rawBuf = readFileSync(join(seedDir, d.raw));
    const resBuf = readFileSync(join(seedDir, d.restatement));
    const rawDisk = sha256(rawBuf);
    const resDisk = sha256(resBuf);

    if (rawBuf.length !== d.raw_bytes || rawDisk !== d.raw_sha256) {
      problems.push(
        `#${d.sequence_no}: raw on-disk mismatch ` +
          `(bytes ${rawBuf.length}/${d.raw_bytes}, sha ${rawDisk} vs ${d.raw_sha256})`
      );
    }
    if (resBuf.length !== d.restatement_bytes || resDisk !== d.restatement_sha256) {
      problems.push(
        `#${d.sequence_no}: restatement on-disk mismatch ` +
          `(bytes ${resBuf.length}/${d.restatement_bytes}, sha ${resDisk} vs ${d.restatement_sha256})`
      );
    }
    prepared.push({ d, rawBuf, resBuf, rawDisk, resDisk });
  }

  if (problems.length) {
    throw fail(422, `refusing to seed:\n  ${problems.join("\n  ")}`);
  }

  // ----- Fail-closed: seed an empty corpus once, never append -----
  const [{ count }] = await sql`
    SELECT count(*)::int AS count FROM dreams WHERE user_id = ${user_id}
  `;
  if (count > 0) {
    throw fail(
      409,
      `corpus for subject ${user_id} already has ${count} dream(s); seeding is once-only`
    );
  }

  // ----- Phase B: atomic insert, explicit utf8 decode at the boundary -----
  const queries = prepared.map(({ d, rawBuf, resBuf }) => {
    const rawText = rawBuf.toString("utf8");
    const bodyText = resBuf.toString("utf8");
    return sql`
      WITH new_dream AS (
        INSERT INTO dreams (user_id, sequence_no, dreamt_on, capture_method, raw_transcript)
        VALUES (${user_id}, ${d.sequence_no}, ${d.dreamt_on}, ${capture_method}, ${rawText})
        ON CONFLICT (user_id, sequence_no) DO NOTHING
        RETURNING id
      ),
      new_restatement AS (
        INSERT INTO restatements (dream_id, body, model, prompt_version)
        SELECT id, ${bodyText}, ${restatement_model}, ${restatement_prompt_version}
        FROM new_dream
        RETURNING id
      )
      SELECT (SELECT id FROM new_dream) AS dream_id,
             (SELECT id FROM new_restatement) AS restatement_id
    `;
  });
  const txResults = await sql.transaction(queries);

  // ----- Phase C: read back, re-hash, compare -----
  const rows = [];
  for (let i = 0; i < prepared.length; i++) {
    const { d, rawDisk, resDisk } = prepared[i];
    const { dream_id: dreamId, restatement_id: restatementId } = txResults[i][0];
    if (!dreamId || !restatementId) {
      throw fail(500, `#${d.sequence_no}: insert returned no id (unexpected conflict)`);
    }

    const [dreamRow] = await sql`SELECT raw_transcript FROM dreams WHERE id = ${dreamId}`;
    const [resRow] = await sql`SELECT body FROM restatements WHERE id = ${restatementId}`;
    const rawBack = sha256(Buffer.from(dreamRow.raw_transcript, "utf8"));
    const resBack = sha256(Buffer.from(resRow.body, "utf8"));

    rows.push({
      sequence_no: d.sequence_no,
      dream_id: dreamId,
      raw: {
        bytes: d.raw_bytes,
        expected: d.raw_sha256,
        on_disk: rawDisk,
        after_read_back: rawBack,
        pass: rawDisk === d.raw_sha256 && rawBack === d.raw_sha256,
      },
      restatement: {
        bytes: d.restatement_bytes,
        expected: d.restatement_sha256,
        on_disk: resDisk,
        after_read_back: resBack,
        pass: resDisk === d.restatement_sha256 && resBack === d.restatement_sha256,
      },
    });
  }

  const ok = rows.every((r) => r.raw.pass && r.restatement.pass);
  return { ok, inserted: rows.length, dreams: rows };
}
