import Anthropic from "@anthropic-ai/sdk";
import { getSql } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";

// Load the API key that pays for this user's calls, decrypt it, and
// instantiate a client for this request only. Decryption happens server-side,
// inside the request that makes the LLM call. No shared server key fallback.
export type UserClient =
  | {
      client: Anthropic;
      keyId: string;
      /** Whose key is paying. Equal to userId unless the account is sponsored. */
      billedTo: string;
    }
  | { error: "NO_KEY" };

type KeyRow = {
  id: string;
  user_id: string;
  ciphertext: string;
  iv: string;
  auth_tag: string;
};

/**
 * Which key pays.
 *
 * A sponsor's key wins over the account's own, because sponsorship is set
 * deliberately, one account at a time, by the person whose money it is — when
 * it is on it should do what it says rather than silently defer to a key the
 * sponsored person happens to have added. If the sponsor has no active key,
 * the account's own is used rather than failing: falling back is confusing,
 * but refusing to generate while a working key sits on file is worse.
 *
 * The key itself never leaves this function. The sponsored account can spend
 * it and can never see it.
 */
export async function getUserAnthropic(userId: string): Promise<UserClient> {
  const sql = getSql();

  let rows: KeyRow[];
  try {
    rows = (await sql`
      WITH me AS (SELECT key_sponsor_id FROM users WHERE id = ${userId})
      SELECT k.id, k.user_id,
             encode(k.ciphertext, 'base64') AS ciphertext,
             encode(k.iv, 'base64')         AS iv,
             encode(k.auth_tag, 'base64')   AS auth_tag
      FROM user_api_keys k, me
      WHERE k.status = 'active'
        AND (k.user_id = ${userId} OR k.user_id = me.key_sponsor_id)
      ORDER BY (k.user_id IS NOT DISTINCT FROM me.key_sponsor_id) DESC
      LIMIT 1
    `) as KeyRow[];
  } catch (err) {
    // key_sponsor_id arrives in 0023. Until it does, everyone pays for
    // themselves — which is what the app did before, so fall back to that
    // rather than letting a schema gap stop every generation in the app.
    if (!/does not exist/i.test(err instanceof Error ? err.message : String(err))) throw err;
    rows = (await sql`
      SELECT id, user_id,
             encode(ciphertext, 'base64') AS ciphertext,
             encode(iv, 'base64')         AS iv,
             encode(auth_tag, 'base64')   AS auth_tag
      FROM user_api_keys
      WHERE user_id = ${userId} AND status = 'active'
      LIMIT 1
    `) as KeyRow[];
  }

  if (rows.length === 0) return { error: "NO_KEY" };

  const apiKey = decrypt({
    ciphertext: rows[0].ciphertext,
    iv: rows[0].iv,
    authTag: rows[0].auth_tag,
  });
  return { client: new Anthropic({ apiKey }), keyId: rows[0].id, billedTo: rows[0].user_id };
}

export async function markKeyVerified(keyId: string): Promise<void> {
  const sql = getSql();
  await sql`UPDATE user_api_keys SET last_verified_at = now() WHERE id = ${keyId}`;
}

// Persist a new key: deactivate any existing active key and insert the new one
// (active), atomically. last_four is the last 4 chars for display; the full key
// is never stored in plaintext.
export async function persistNewKey(
  userId: string,
  apiKey: string,
  label: string | null
): Promise<{ lastFour: string }> {
  const sql = getSql();
  const enc = encrypt(apiKey);
  const lastFour = apiKey.slice(-4);
  await sql.transaction([
    sql`UPDATE user_api_keys SET status = 'inactive' WHERE user_id = ${userId} AND status = 'active'`,
    sql`
      INSERT INTO user_api_keys
        (user_id, ciphertext, iv, auth_tag, last_four, label, last_verified_at, status)
      VALUES (
        ${userId},
        decode(${enc.ciphertext}, 'base64'),
        decode(${enc.iv}, 'base64'),
        decode(${enc.authTag}, 'base64'),
        ${lastFour}, ${label}, now(), 'active'
      )
    `,
  ]);
  return { lastFour };
}
