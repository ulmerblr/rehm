"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { dict } from "@/lib/i18n";
import type { Lang } from "@/lib/lang";

export default function KeyForm({ hasKey, lang }: { hasKey: boolean; lang: Lang }) {
  const t = dict(lang);
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function save() {
    setError(null);
    setOk(null);
    if (!apiKey.trim()) {
      setError(t.enterYourKey);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey, label }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || t.couldNotSaveKey);
      setApiKey("");
      setLabel("");
      setOk(`Saved and verified · ends ${data.lastFour}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div>
        <label htmlFor="apiKey">{hasKey ? t.replaceApiKey : "API key"}</label>
        <input
          id="apiKey"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          autoComplete="off"
          placeholder="sk-ant-…"
        />
      </div>
      <div>
        <label htmlFor="label">{t.labelOptional}</label>
        <input
          id="label"
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t.labelPlaceholder}
        />
      </div>
      {error && <p className="notice">{error}</p>}
      {ok && <p className="stamp">{ok}</p>}
      <button className="btn btn-primary btn-lg" onClick={save} disabled={busy}>
        {busy ? t.verifying : hasKey ? t.replaceKey : t.saveKey}
      </button>
      <p className="muted" style={{ fontSize: "0.9rem" }}>
        {t.keyNote}
      </p>
    </div>
  );
}
