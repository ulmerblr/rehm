// Server-side access gate. Until native auth lands, the whole app sits behind a
// single shared VIEW_TOKEN (server-only env secret), exchanged once for a
// signed, httpOnly session cookie. Middleware verifies the cookie on every
// request — including preview deploys — so no route ever renders raw_transcript
// without it. When SSO arrives it replaces this gate; it does not run alongside.
//
// Uses Web Crypto (crypto.subtle) so the same helpers work in the Edge
// middleware runtime and in Node route handlers.

export const SESSION_COOKIE = "rehm_session";

// The cookie value is an HMAC over a fixed marker keyed by VIEW_TOKEN. Only a
// holder of VIEW_TOKEN can produce it, and it is stable so a single login lasts
// until the cookie expires. httpOnly + Secure keep it out of JS and off HTTP.
export async function sessionCookieValue(viewToken: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(viewToken),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode("rehm-view-v1")
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Constant-time string comparison.
export function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
