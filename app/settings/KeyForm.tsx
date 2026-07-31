"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function KeyForm({ hasKey }: { hasKey: boolean }) {
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
      setError("Enter your API key.");
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
      if (!res.ok) throw new Error(data?.message || "Could not save key.");
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
        <label htmlFor="apiKey">{hasKey ? "Replace API key" : "API key"}</label>
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
        <label htmlFor="label">Label (optional)</label>
        <input
          id="label"
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. personal"
        />
      </div>
      {error && <p className="notice">{error}</p>}
      {ok && <p className="muted" style={{ color: "var(--ok)" }}>{ok}</p>}
      <button className="btn btn-primary btn-lg" onClick={save} disabled={busy}>
        {busy ? "Verifying…" : hasKey ? "Replace key" : "Save key"}
      </button>
      <p className="muted" style={{ fontSize: "0.9rem" }}>
        The key is verified with one call, then encrypted. It is never shown again and never leaves
        the server except to call Anthropic on your behalf.
      </p>
    </div>
  );
}
