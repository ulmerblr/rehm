"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LANG_ENDONYM, LANGS, type Lang } from "@/lib/lang";
import { dict } from "@/lib/i18n";

/**
 * First run. Two questions, in the order their consequences bite.
 *
 * Language is asked first and required, because it decides what the app MAKES
 * — dictation, restatements, analyses — and the raw transcript is immutable,
 * so a dream captured under the wrong one cannot be repaired by changing the
 * setting afterwards. It is one tap; there is no reason to let it drift.
 *
 * The key is the loud second, but not a wall. Creating one means leaving for
 * console.anthropic.com and putting credit on an account, which is a real
 * errand — trapping someone mid-errand on a screen they can't leave would just
 * lose them. Continuing without one is allowed, and says so plainly rather
 * than pretending the app will work.
 */
export default function SetupFlow({ initialLang }: { initialLang: Lang }) {
  const router = useRouter();

  // Null until chosen: the screen must not imply a default was picked for you.
  const [lang, setLang] = useState<Lang | null>(null);
  const [dual, setDual] = useState(false);
  const [key, setKey] = useState("");
  const [keySaved, setKeySaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Follows the choice the moment it's made, so picking Español turns the rest
  // of this screen into Spanish — the first proof that the setting took.
  const t = dict(lang ?? initialLang);

  async function saveKey() {
    const value = key.trim();
    if (!value) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || `failed (${res.status})`);
      setKeySaved(true);
      setKey("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!lang) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ language: lang, dual }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || `failed (${res.status})`);
      router.replace("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>{t.setupTitle}</h1>
      <p className="machine" style={{ marginTop: 0 }}>
        {t.setupLead}
      </p>

      <h2>{t.setupPickLanguage}</h2>
      {/* Named in themselves — a picker in a language you don't read is no use
          to the person reaching for it. */}
      <div className="row" style={{ gap: 10 }}>
        {LANGS.map((l) => (
          <button
            key={l}
            className={l === lang ? "btn btn-primary" : "btn"}
            onClick={() => setLang(l)}
            disabled={busy}
          >
            {LANG_ENDONYM[l]}
          </button>
        ))}
      </div>
      <p className="machine" style={{ marginTop: 12 }}>
        {t.setupLanguageWhy}
      </p>

      <div className="choice-stack">
        {[false, true].map((value) => (
          <button
            key={String(value)}
            type="button"
            className={dual === value ? "choice choice-on" : "choice"}
            onClick={() => setDual(value)}
            disabled={busy}
            aria-pressed={dual === value}
          >
            <span className="choice-mark" aria-hidden="true" />
            <span>
              <span className="choice-title">
                {value ? t.dualLanguage : t.singleLanguage}
              </span>
              <span className="choice-note">
                {value ? t.setupBothLanguages : t.singleLanguageNote}
              </span>
            </span>
          </button>
        ))}
      </div>

      <h2>{t.setupKey}</h2>
      <p className="machine" style={{ marginTop: 0 }}>
        {t.setupKeyWhy}
      </p>

      {keySaved ? (
        <p className="stamp stamp-machine">{t.setupKeySaved}</p>
      ) : (
        <>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-ant-…"
            autoComplete="off"
            aria-label={t.setupKey}
          />
          <button
            className="btn"
            onClick={saveKey}
            disabled={busy || !key.trim()}
            style={{ marginTop: 10 }}
          >
            {busy ? t.verifying : t.saveKey}
          </button>
          <p className="machine" style={{ marginTop: 12 }}>
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
              console.anthropic.com
            </a>{" "}
            — {t.setupKeyHow}
          </p>
        </>
      )}

      {error && (
        <p className="notice" style={{ marginTop: 16 }}>
          {error}
        </p>
      )}

      <div style={{ marginTop: 24 }}>
        <button
          className="btn btn-primary btn-block btn-lg"
          onClick={finish}
          disabled={busy || !lang}
        >
          {keySaved ? t.setupContinue : t.setupContinueNoKey}
        </button>
      </div>
    </div>
  );
}
