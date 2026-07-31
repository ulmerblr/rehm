"use client";

import { useState } from "react";

// Copies a plain-text export to the clipboard for pasting into any LLM to
// continue elsewhere. Falls back to a selectable textarea if the clipboard API
// is unavailable.
export default function ExportButton({ text, label = "Export" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShowFallback(true);
    }
  }

  return (
    <div>
      <button className="btn" onClick={copy} type="button">
        {copied ? "Copied ✓" : label}
      </button>
      {showFallback && (
        <textarea
          readOnly
          value={text}
          onFocus={(e) => e.currentTarget.select()}
          style={{ marginTop: 10 }}
        />
      )}
    </div>
  );
}
