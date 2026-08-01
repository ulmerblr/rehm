"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LANGS, LANG_ENDONYM, type Lang } from "@/lib/lang";

// Three letters, not two: ENG/ESP reads as a language everywhere, while EN/ES
// looks like a country code and, next to each other, like a typo.
const CODE: Record<Lang, string> = { en: "ENG", es: "ESP" };

/**
 * Flip the whole interface into the other language.
 *
 * Both languages are always on screen with the current one filled. A control
 * that showed only the language you'd switch TO is ambiguous at a glance —
 * you can't tell whether the label names where you are or where you'd go — and
 * it's worse in the moment it exists for, which is handing someone your phone.
 *
 * This is a lens, not a preference: it never touches what the account writes
 * in. Only rendered on dual-language accounts.
 */
export default function LangToggle({ current }: { current: Lang }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  async function pick(lang: Lang) {
    if (lang === current) return;
    setBusy(true);
    try {
      await fetch("/api/lang", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lang }),
      });
      // Server components hold the copy, so the whole tree has to re-render.
      startTransition(() => router.refresh());
    } catch {
      // A failed flip leaves the screen exactly as it was, which is readable.
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lang-seg" role="group" aria-label="Language">
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          className={l === current ? "lang-seg-btn lang-seg-on" : "lang-seg-btn"}
          onClick={() => pick(l)}
          disabled={busy || pending}
          aria-pressed={l === current}
          aria-label={LANG_ENDONYM[l]}
          title={LANG_ENDONYM[l]}
        >
          {CODE[l]}
        </button>
      ))}
    </div>
  );
}
