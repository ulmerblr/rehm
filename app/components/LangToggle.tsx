"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LANGS, LANG_ENDONYM, type Lang } from "@/lib/lang";

// Three letters, not two: ENG/ESP reads as a language everywhere, while EN/ES
// looks like a country code and, side by side, like a typo.
const CODE: Record<Lang, string> = { en: "ENG", es: "ESP" };

/**
 * A flag behind each code, run at low opacity so it reads as a texture rather
 * than a sticker — the palette here is navy, brass and cream, and a saturated
 * flag would tear a hole in it.
 *
 * A flag names a country, not a language, so one has to be picked. These match
 * the locales the app already uses for dictation (en-US, es-MX). Swap the
 * shapes below for the Union Jack or the Spanish flag if the pairing should be
 * different — nothing else depends on them.
 *
 * Drawn inline rather than fetched: the whole page is served with a strict
 * content policy, and two small shapes are cheaper than any request.
 */
function Flag({ lang }: { lang: Lang }) {
  if (lang === "en") {
    // Thirteen stripes and the canton. At this size the star field is texture,
    // so it's a scatter of dots rather than a false count of fifty.
    return (
      <svg className="lang-flag" viewBox="0 0 40 28" aria-hidden="true" focusable="false">
        <rect width="40" height="28" fill="#f5f2ea" />
        {[0, 2, 4, 6, 8, 10, 12].map((i) => (
          <rect key={i} y={(i * 28) / 13} width="40" height={28 / 13} fill="#b32b34" />
        ))}
        <rect width="17" height={(28 / 13) * 7} fill="#26417a" />
        {[0, 1, 2, 3].map((r) =>
          [0, 1, 2, 3, 4].map((c) => (
            <circle
              key={`${r}-${c}`}
              cx={2.2 + c * 3.2 + (r % 2) * 1.6}
              cy={2 + r * 3.4}
              r="0.75"
              fill="#f5f2ea"
            />
          ))
        )}
      </svg>
    );
  }
  // Three vertical bands. The eagle is unreadable this small, so the centre
  // carries a soft mark where the eye expects one instead of a smudge.
  return (
    <svg className="lang-flag" viewBox="0 0 40 28" aria-hidden="true" focusable="false">
      <rect width="40" height="28" fill="#f5f2ea" />
      <rect width="13.33" height="28" fill="#1c7a4d" />
      <rect x="26.67" width="13.34" height="28" fill="#b32b34" />
      <ellipse cx="20" cy="14" rx="3.6" ry="2.9" fill="#6b5433" opacity="0.65" />
    </svg>
  );
}

/**
 * Flip the whole interface into the other language.
 *
 * Both languages stay on screen with the current one filled. A control showing
 * only the language you'd switch TO is ambiguous at a glance — you can't tell
 * whether the label names where you are or where you'd go — and that is worst
 * in the moment it exists for, which is handing someone your phone.
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
          <Flag lang={l} />
          <span className="lang-code">{CODE[l]}</span>
        </button>
      ))}
    </div>
  );
}
