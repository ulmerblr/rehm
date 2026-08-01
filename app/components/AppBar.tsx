import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { getUserEmail } from "@/lib/queries";
import AppBarChrome from "./AppBarChrome";

// Resolves who is signed in, then hands off to the client shell that decides
// whether to render. Deliberately does NOT use requireUserId: this renders on
// the auth pages too, where there is no session and a redirect would loop.
export default async function AppBar() {
  const store = await cookies();
  const userId = await verifySession(store.get(SESSION_COOKIE)?.value);

  let email: string | null = null;
  if (userId) {
    try {
      email = await getUserEmail(userId);
    } catch {
      // The bar must render even if the lookup fails — it just loses the chip.
      email = null;
    }
  }

  return <AppBarChrome email={email} />;
}
