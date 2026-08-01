"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LANG_ENDONYM, otherLang, type Lang } from "@/lib/lang";

/**
 * Flip the whole interface into the other language.
 *
 * This is a lens for handing someone your phone, not a preference — it never
 * touches what the account writes in. It shows the language you would switch
 * TO, named in itself, because a control offering "Spanish" is no use to
 * someone who is reaching for it precisely because they don't read English.
 *
 * Only rendered on dual-language accounts; a single-language account has
 * nothing to switch to and never sees it.
 */
export default function LangToggle({ current }: { current: Lang }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const target = otherLang(current);

  async function flip() {
    setBusy(true);
    try {
      await fetch("/api/lang", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lang: target }),
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
    <button
      type="button"
      className="lang-toggle"
      onClick={flip}
      disabled={busy || pending}
      aria-label={LANG_ENDONYM[target]}
      title={LANG_ENDONYM[target]}
    >
      {target.toUpperCase()}
    </button>
  );
}
