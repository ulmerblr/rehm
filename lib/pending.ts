// Remembers work started in one view so another view can still show it running.
//
// A generation is fired from a component that unmounts the moment you navigate
// away. The request keeps going server-side, but the "running" state lives only
// in that component, so returning to the page showed no sign of it — and
// tempted a second, separately billed run. These markers survive navigation and
// reloads, so the state follows the work rather than the component.

const PREFIX = "rehm.pending.";
// Long enough for a slow generation, short enough that a marker left behind by
// a crashed tab clears itself instead of pinning the row forever.
const TTL_MS = 5 * 60 * 1000;

function key(kind: string, id: string): string {
  return `${PREFIX}${kind}.${id}`;
}

export function markPending(kind: string, id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(kind, id), String(Date.now()));
  } catch {
    // Storage can be unavailable (private mode, quota). Losing the marker only
    // costs the resumed indicator, so never let it break the action itself.
  }
}

export function clearPending(kind: string, id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key(kind, id));
  } catch {
    /* see above */
  }
}

export function isPending(kind: string, id: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(key(kind, id));
    if (!raw) return false;
    if (Date.now() - Number(raw) > TTL_MS) {
      window.localStorage.removeItem(key(kind, id));
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
