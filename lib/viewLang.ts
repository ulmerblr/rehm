import { cookies } from "next/headers";
import { dict, type Dict } from "@/lib/i18n";
import { getLangSettings } from "@/lib/translations";
import { VIEW_LANG_COOKIE, asLang, type Lang } from "@/lib/lang";

export type View = {
  /** What the screen is currently showing. */
  lang: Lang;
  /** What this account writes in. Unaffected by the toggle. */
  accountLang: Lang;
  /** Whether both languages are prepared — decides if the toggle exists at all. */
  dual: boolean;
  /** Whether a key will be found — this account's own, or its sponsor's. */
  hasKey: boolean;
  /** Whose key is paying, when it isn't this account's. */
  sponsorEmail: string | null;
  /** The first account to exist administers the instance. */
  isOwner: boolean;
  /** Interface strings for `lang`. */
  t: Dict;
};

/**
 * Resolve what language this page should render in.
 *
 * The cookie is a lens: it is set only when someone taps the toggle, and it is
 * a session cookie, so closing the app returns to the account's own language.
 * She hands you the phone in English, takes it back, and it is Spanish again
 * next time she opens it — without her having to undo anything.
 *
 * A single-language account never has a cookie honoured, so a stale one left
 * over from a previous setting can't strand the interface in a language the
 * user doesn't read.
 */
export async function resolveView(userId: string): Promise<View> {
  const { language, dual, hasKey, sponsorEmail, isOwner } = await getLangSettings(userId);
  if (!dual) {
    return {
      lang: language,
      accountLang: language,
      dual: false,
      hasKey,
      sponsorEmail,
      isOwner,
      t: dict(language),
    };
  }
  const jar = await cookies();
  const lang = asLang(jar.get(VIEW_LANG_COOKIE)?.value, language);
  return {
    lang,
    accountLang: language,
    dual: true,
    hasKey,
    sponsorEmail,
    isOwner,
    t: dict(lang),
  };
}
