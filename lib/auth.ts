// Native-auth session cookie. After login/signup the server sets a signed,
// httpOnly cookie carrying "<userId>.<expiresAtMs>.<hmac(userId.expiresAtMs)>".
// The user id and expiry are not secret; the HMAC (keyed by SESSION_SECRET)
// prevents forgery. Expiry is enforced server-side in the token itself, not
// just via the cookie's max-age, so a copied cookie value still expires.
// Verified on every request — the client's user_id is never trusted.
//
// Uses Web Crypto so the same verify runs in Edge middleware and Node routes.

export const SESSION_COOKIE = "rehm_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, in seconds

async function hmacHex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function makeSessionValue(userId: string): Promise<string> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  const expiresAt = Date.now() + SESSION_MAX_AGE * 1000;
  const payload = `${userId}.${expiresAt}`;
  return `${payload}.${await hmacHex(secret, payload)}`;
}

// Returns the verified, non-expired user id, or null.
export async function verifySession(cookie: string | undefined): Promise<string | null> {
  const secret = process.env.SESSION_SECRET;
  if (!secret || !cookie) return null;
  const parts = cookie.split(".");
  if (parts.length !== 3) return null;
  const [userId, expiresAt, sig] = parts;
  if (!/^\d+$/.test(expiresAt)) return null;

  const expected = await hmacHex(secret, `${userId}.${expiresAt}`);
  if (!timingSafeEqualStr(sig, expected)) return null;
  if (Number(expiresAt) < Date.now()) return null;
  return userId;
}
