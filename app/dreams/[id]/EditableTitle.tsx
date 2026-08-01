"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// The dream's title, editable in place. Shows the current title (generated or
// derived) with an Edit affordance; saving writes your own text over it.
export default function EditableTitle({
  dreamId,
  initialTitle,
  isCustom,
}: {
  dreamId: string;
  initialTitle: string;
  isCustom: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [custom, setCustom] = useState(isCustom);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialTitle);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const next = draft.replace(/\s+/g, " ").trim();
    if (!next) {
      setError("Title can't be empty.");
      return;
    }
    if (next === title && custom) {
      setEditing(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/dreams/${dreamId}/title`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || `failed (${res.status})`);
      setTitle(data.title ?? next);
      setCustom(true);
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div style={{ marginTop: 6 }}>
        <input
          type="text"
          value={draft}
          maxLength={120}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          aria-label="Dream title"
        />
        <div className="row" style={{ gap: 10, marginTop: 10 }}>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save title"}
          </button>
          <button
            className="btn"
            onClick={() => {
              setDraft(title);
              setEditing(false);
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

  return (
    <div className="row" style={{ gap: 10, marginTop: 4, alignItems: "baseline" }}>
      <span style={{ fontSize: "1.15rem", fontWeight: 600 }}>{title}</span>
      <button
        className="linklike"
        onClick={() => {
          setDraft(title);
          setEditing(true);
          setError(null);
        }}
      >
        {custom ? "Edit" : "Rename"}
      </button>
    </div>
  );
}
