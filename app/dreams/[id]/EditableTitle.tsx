"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// The dream's title, editable in place.
//
// If the dream has no real title yet, what's displayed is just a preview derived
// from the transcript — so the edit field starts EMPTY with that text as a
// placeholder. Pre-filling a long derived sentence would mean clearing a
// paragraph on a phone keyboard before typing six words.
export default function EditableTitle({
  dreamId,
  initialTitle,
  isCustom,
  displayTitle,
  translatedNote,
}: {
  dreamId: string;
  initialTitle: string;
  isCustom: boolean;
  /** What to show while not editing — the translation, when one is on screen. */
  displayTitle?: string;
  /** Label marking the shown title as machine words, if it is. */
  translatedNote?: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [saved, setSaved] = useState(isCustom);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(isCustom ? initialTitle : "");
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openEditor() {
    // Only carry the text over when it's a real saved title, not a preview.
    // Deliberately `title`, not the displayed translation. Saving what's on
    // screen would overwrite the real title with a machine rendering of it.
    setDraft(saved ? title : "");
    setEditing(true);
    setError(null);
  }

  async function save() {
    const next = draft.replace(/\s+/g, " ").trim();
    if (!next) {
      setError("Title can't be empty.");
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
      setSaved(true);
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  // Ask the model for a title — for dreams that never got one at capture.
  async function suggest() {
    setSuggesting(true);
    setError(null);
    try {
      const res = await fetch(`/api/dreams/${dreamId}/title/suggest`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || `failed (${res.status})`);
      setDraft(data.title ?? "");
      setTitle(data.title ?? title);
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setSuggesting(false);
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
          placeholder={saved ? "Title" : title}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          aria-label="Dream title"
        />
        <div className="row" style={{ gap: 10, marginTop: 10 }}>
          <button className="btn btn-primary" onClick={save} disabled={busy || suggesting}>
            {busy ? "Saving…" : "Save title"}
          </button>
          <button className="btn" onClick={suggest} disabled={busy || suggesting}>
            {suggesting ? "Thinking…" : "Suggest one"}
          </button>
          <button
            className="btn"
            onClick={() => {
              setEditing(false);
              setError(null);
            }}
            disabled={busy || suggesting}
          >
            Cancel
          </button>
        </div>
        {error && <p className="notice" style={{ marginTop: 10, marginBottom: 0 }}>{error}</p>}
      </div>
    );
  }

  // While a translation is on screen it is what gets read; `title` remains the
  // real one underneath, and is what the editor opens with.
  const shown = displayTitle ?? title;

  return (
    <div>
      <div className="row" style={{ gap: 10, marginTop: 4, alignItems: "baseline" }}>
        <span style={{ fontSize: "1.15rem", fontWeight: 600 }}>{shown}</span>
        <button className="linklike" onClick={openEditor}>
          {saved ? "Edit" : "Add a title"}
        </button>
      </div>
      {translatedNote && shown !== title && (
        <span className="stamp stamp-machine translated-note">{translatedNote}</span>
      )}
    </div>
  );
}
