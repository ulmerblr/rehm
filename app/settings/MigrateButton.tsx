"use client";

import { useState } from "react";
import { dict } from "@/lib/i18n";
import type { Lang } from "@/lib/lang";

type FileResult = { file: string; ok: boolean; skipped?: boolean; error?: string };

// Break-glass only. Migrations already run automatically on every deploy; this
// button just lets you re-check on demand if something ever looks off.
export default function MigrateButton({ lang }: { lang: Lang }) {
  const t = dict(lang);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/migrate", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        results?: FileResult[];
        error?: string;
      };
      const results = data.results ?? [];
      if (!res.ok) {
        const failed = results.find((r) => !r.ok);
        throw new Error(
          failed ? `${failed.file}: ${failed.error}` : data.error || `failed (${res.status})`
        );
      }
      const appliedNow = results.filter((r) => r.ok && !r.skipped).map((r) => r.file);
      setStatus(
        appliedNow.length
          ? `Applied: ${appliedNow.join(", ")}`
          : "Schema already up to date."
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button className="btn" onClick={run} disabled={busy}>
        {busy ? t.checking : t.applyMigrations}
      </button>
      {status && (
        <p className="muted" style={{ marginTop: 8 }}>
          {status}
        </p>
      )}
    </div>
  );
}
