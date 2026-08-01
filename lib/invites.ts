import { randomBytes } from "node:crypto";

// Invitation codes get read aloud, retyped from a text message, and squinted at
// on a phone — so the alphabet excludes every character pair that gets confused
// in that setting: 0/O, 1/I/L, 5/S, 8/B. What's left is unambiguous.
const ALPHABET = "ACDEFGHJKMNPQRTUVWXY234679";
const GROUPS = 3;
const GROUP_LEN = 4;
const LENGTH = GROUPS * GROUP_LEN;

/**
 * e.g. "K7RM-4PQD-92XV". ~56 bits of entropy — not guessable.
 *
 * Drawn by rejection sampling rather than plain modulo, so every character in
 * the alphabet is equally likely.
 */
export function generateInviteCode(): string {
  const limit = 256 - (256 % ALPHABET.length); // largest unbiased byte value
  let out = "";
  while (out.length < LENGTH) {
    for (const b of randomBytes(LENGTH)) {
      if (b >= limit) continue;
      out += ALPHABET[b % ALPHABET.length];
      if (out.length === LENGTH) break;
    }
  }
  return out.match(new RegExp(`.{1,${GROUP_LEN}}`, "g"))!.join("-");
}

// Accept what a person actually types: any case, spaces, missing or extra
// dashes. Normalizing on both sides means a code copied out of a text message
// with a stray space still works.
export function normalizeInviteCode(raw: string): string {
  const bare = String(raw)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (bare.length !== LENGTH) return bare; // let the lookup fail
  return bare.match(new RegExp(`.{1,${GROUP_LEN}}`, "g"))!.join("-");
}

export type InviteStatus = "open" | "used" | "revoked";

/** Used wins over revoked: once someone is through the door, that's the story. */
export function inviteStatus(row: { used_at: unknown; revoked_at: unknown }): InviteStatus {
  if (row.used_at != null) return "used";
  if (row.revoked_at != null) return "revoked";
  return "open";
}
