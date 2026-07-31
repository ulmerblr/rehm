import { timingSafeEqual } from "node:crypto";

/**
 * Shared server-side access gate. Until native auth lands, protected routes
 * check a bearer token against a server-only env secret. This is the single
 * gating primitive: the seed route uses it now, and the read-only journal
 * (/dreams, /dreams/[id]) will use the same server-side check — never a
 * client-side redirect. When SSO arrives it replaces this gate; it does not
 * run alongside it.
 *
 * Returns true only on an exact, constant-time token match.
 */
export function hasValidBearer(
  request: Request,
  expected: string | undefined
): boolean {
  if (!expected) return false;
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.headers.get("x-seed-token") ??
    "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
