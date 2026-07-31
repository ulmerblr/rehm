import Anthropic from "@anthropic-ai/sdk";
import { getSql } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";

// Load the session user's active API key, decrypt it, and instantiate a client
// for this request only. Decryption happens server-side, inside the request
// that makes the LLM call. No shared server key fallback.
export type UserClient = { client: Anthropic; keyId: string } | { error: "NO_KEY" };

export async function getUserAnthropic(userId: string): Promise<UserClient> {
  const sql = getSql();
  const rows = (await sql`
    SELECT id,
           encode(ciphertext, 'base64') AS ciphertext,
           encode(iv, 'base64')          AS iv,
           encode(auth_tag, 'base64')    AS auth_tag
    FROM user_api_keys
    WHERE user_id = ${userId} AND status = 'active'
    LIMIT 1
  `) as Array<{ id: string; ciphertext: string; iv: string; auth_tag: string }>;
  if (rows.length === 0) return { error: "NO_KEY" };

  const apiKey = decrypt({
    ciphertext: rows[0].ciphertext,
    iv: rows[0].iv,
    authTag: rows[0].auth_tag,
  });
  return { client: new Anthropic({ apiKey }), keyId: rows[0].id };
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
