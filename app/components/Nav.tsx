import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { resolveView } from "@/lib/viewLang";
import { dict } from "@/lib/i18n";
import { DEFAULT_LANG } from "@/lib/lang";
import BottomNav from "./BottomNav";

// Resolves the view language server-side and hands the nav its labels. Like
// AppBar, this renders on the auth pages too, so it must tolerate no session
// rather than redirecting — falling back to the default language, which is
// what someone who isn't signed in would see anyway.
export default async function Nav() {
  const store = await cookies();
  const userId = await verifySession(store.get(SESSION_COOKIE)?.value);

  let t = dict(DEFAULT_LANG);
  if (userId) {
    try {
      t = (await resolveView(userId)).t;
    } catch {
      // Keep the default rather than losing the navigation entirely.
    }
  }

  return (
    <BottomNav
      labels={{
        home: t.navHome,
        dreams: t.navDreams,
        trends: t.navTrends,
        settings: t.navSettings,
      }}
    />
  );
}
