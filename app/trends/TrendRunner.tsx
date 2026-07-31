"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TrendRunner() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/trends/run", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `failed (${res.status})`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button className="btn btn-primary btn-block btn-lg" onClick={run} disabled={busy}>
        {busy ? "Running a trend pass…" : "Run a trend pass"}
      </button>
      {error && <p className="notice" style={{ marginTop: 12 }}>{error}</p>}
    </div>
  );
}
