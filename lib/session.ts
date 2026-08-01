import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { getLangSettings } from "@/lib/translations";

// Server-component helper: the verified session user id, or a redirect to
// /login. Middleware already gates routes; this is the typed accessor pages use.
export async function requireUserId(): Promise<string> {
  const store = await cookies();
  const userId = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!userId) redirect("/login");
  return userId;
}

/**
 * The session user id, but only once first-run setup has been answered.
 *
 * Language has to be settled before the first dream is captured — it decides
 * what the recognizer listens for and what the analysis is written in, and the
 * raw transcript is immutable, so a dream recorded under the wrong one stays
 * that way. That is why this gates rather than nudges.
 *
 * Deliberately NOT applied to /setup itself (which would loop) or /settings
 * (which is where someone lands when they come back with a key in hand).
 */
export async function requireOnboarded(): Promise<string> {
  const userId = await requireUserId();
  const { onboarded } = await getLangSettings(userId);
  if (!onboarded) redirect("/setup");
  return userId;
}
