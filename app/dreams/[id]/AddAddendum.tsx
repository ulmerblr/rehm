"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { dict } from "@/lib/i18n";
import type { Lang } from "@/lib/lang";

// "I remembered something else." Adds to the record without touching the
// original transcript — the first click just opens the box, so this can't be
// mistaken for editing what was already said.
export default function AddAddendum({ dreamId, lang }: { dreamId: string; lang: Lang }) {
  const router = useRouter();
  const t = dict(lang);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const body = text.trim();
    if (!body) {
      setError(t.nothingToAdd);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/dreams/${dreamId}/addenda`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || `failed (${res.status})`);
      setText("");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="btn" onClick={() => setOpen(true)}>
        I remembered something else
      </button>
    );
  }

  return (
    <div>
      <p className="muted" style={{ marginTop: 0, fontSize: "0.9rem" }}>
        This is added to the dream, dated today. The original transcript is left as
        it was recorded.
      </p>
      <textarea
        value={text}
        autoFocus
        onChange={(e) => setText(e.target.value)}
        placeholder={t.whatCameBack}
        style={{ minHeight: 140 }}
      />
      <div className="row" style={{ gap: 10, marginTop: 10 }}>
        <button className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? t.adding : t.addToThisDream}
        </button>
        <button
          className="btn"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          disabled={busy}
        >
          Cancel
        </button>
      </div>
      {error && <p className="notice" style={{ marginTop: 10, marginBottom: 0 }}>{error}</p>}
    </div>
  );
}
