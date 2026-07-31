// Native-auth session cookie. After login/signup the server sets a signed,
// httpOnly cookie carrying the user id: "<userId>.<hmac(userId)>". The user id
// is not secret; the HMAC (keyed by SESSION_SECRET) prevents forgery. Verified
// server-side on every request — the client's user_id is never trusted.
//
// Uses Web Crypto so the same verify runs in Edge middleware and Node routes.

export const SESSION_COOKIE = "rehm_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

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

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function makeSessionValue(userId: string): Promise<string> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return `${userId}.${await hmacHex(secret, userId)}`;
}

// Returns the verified user id, or null.
export async function verifySession(cookie: string | undefined): Promise<string | null> {
  const secret = process.env.SESSION_SECRET;
  if (!secret || !cookie) return null;
  const dot = cookie.lastIndexOf(".");
  if (dot <= 0) return null;
  const userId = cookie.slice(0, dot);
  const sig = cookie.slice(dot + 1);
  const expected = await hmacHex(secret, userId);
  return timingSafeEqualStr(sig, expected) ? userId : null;
}
