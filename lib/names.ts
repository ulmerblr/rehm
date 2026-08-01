/**
 * What to call an account on a screen where more than one appears.
 *
 * The address is the identity; a name is only a label for it. The part before
 * the @ is what people actually call each other, so that is the default. But
 * it is not unique — two friends are easily `bill@` at different domains — and
 * a standings table listing "bill" twice is worse than no table at all.
 *
 * So disambiguation is applied to the names that collide and to nothing else:
 * a unique local part stays as it is, a colliding one gains its domain, and
 * the rare pair that still matches falls back to the address in full. Nobody
 * pays for someone else's collision.
 */

/** The part before the @, which is what people call each other. */
export function shortName(email: string): string {
  const at = email.lastIndexOf("@");
  const local = (at > 0 ? email.slice(0, at) : email).trim();
  return local || email;
}

/** The first label of the host: gmail.com → gmail. Enough to tell two apart. */
function domainLabel(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 0) return "";
  return email.slice(at + 1).split(".")[0] ?? "";
}

/**
 * Map every address to the shortest label that is unambiguous within this set.
 * Keyed by the address exactly as passed in, so callers can look up with the
 * value they already hold.
 */
export function displayNames(emails: string[]): Map<string, string> {
  const key = (e: string) => e.trim().toLowerCase();

  const shareShort = new Map<string, number>();
  for (const e of emails) {
    const s = key(shortName(e));
    shareShort.set(s, (shareShort.get(s) ?? 0) + 1);
  }

  // Second pass over the collisions only: does adding the domain settle it?
  const shareWithDomain = new Map<string, number>();
  for (const e of emails) {
    const s = key(shortName(e));
    if ((shareShort.get(s) ?? 0) < 2) continue;
    const w = `${s}@${key(domainLabel(e))}`;
    shareWithDomain.set(w, (shareWithDomain.get(w) ?? 0) + 1);
  }

  const out = new Map<string, string>();
  for (const e of emails) {
    const short = shortName(e);
    const s = key(short);
    if ((shareShort.get(s) ?? 0) < 2) {
      out.set(e, short);
      continue;
    }
    const domain = domainLabel(e);
    if (domain && (shareWithDomain.get(`${s}@${key(domain)}`) ?? 0) < 2) {
      out.set(e, `${short} (${domain})`);
      continue;
    }
    // Same local part at the same domain label — different TLDs, or the same
    // address listed twice. Only the address itself separates them now.
    out.set(e, e);
  }
  return out;
}
