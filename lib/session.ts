import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

// Server-component helper: the verified session user id, or a redirect to
// /login. Middleware already gates routes; this is the typed accessor pages use.
export async function requireUserId(): Promise<string> {
  const store = await cookies();
  const userId = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!userId) redirect("/login");
  return userId;
}
