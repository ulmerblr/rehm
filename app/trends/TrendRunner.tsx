"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  isoDaysAgo,
  isoToday,
  scopeLabel,
  selectInScope,
  type Scope,
} from "@/lib/scope";

type DreamDate = { sequenceNo: number; dreamtOn: string | null };
type Kind = "all" | "last_n" | "range";
type Source = "dreams" | "dreams_and_analyses";

// Scope picker for a trend pass. The dream list is passed in so the count of
// dreams a scope covers is previewed live — you see exactly what the run will
// read before spending anything on it.
export default function TrendRunner({
  dreams,
  analyzedCount,
}: {
  dreams: DreamDate[];
  analyzedCount: number;
}) {
  const router = useRouter();
  const [source, setSource] = useState<Source>("dreams");
  const [kind, setKind] = useState<Kind>("all");
  const [lastN, setLastN] = useState(Math.min(5, Math.max(dreams.length, 1)));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);

  const scope: Scope = useMemo(() => {
    if (kind === "last_n") return { kind: "last_n", lastN };
    if (kind === "range") return { kind: "range", from: from || null, to: to || null };
    return { kind: "all" };
  }, [kind, lastN, from, to]);

  const inScope = useMemo(
    () => (kind === "range" && !from && !to ? [] : selectInScope(dreams, scope)),
    [dreams, scope, kind, from, to]
  );

  function applyPreset(days: number) {
    setKind("range");
    setFrom(isoDaysAgo(days));
    setTo(isoToday());
  }

  async function run() {
    setError(null);
    setDetail(null);
    setBusy(true);
    try {
      const res = await fetch("/api/trends/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scope, source }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // A gateway timeout is produced by the platform, not the route, so it
        // arrives with no body — say what it means and what to do about it.
        if (res.status === 504 || res.status === 502) {
          setDetail(
            `The request hit the server's time limit before the pass finished (${res.status}).`
          );
          throw new Error(
            inScope.length > 1
              ? `Reading ${inScope.length} dreams took too long. Try a smaller scope — say the last ${Math.max(2, Math.floor(inScope.length / 2))}.`
              : "That took too long to finish."
          );
        }
        if (data?.detail) setDetail(String(data.detail));
        throw new Error(data?.message || data?.error || `failed (${res.status})`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  const max = Math.max(dreams.length, 1);
  const canRun = inScope.length > 0 && !busy;

  return (
    <div className="card" style={{ margin: 0 }}>
      <div className="seq" style={{ marginBottom: 8 }}>Read</div>
      <div className="segmented">
        {(
          [
            ["dreams", "Dreams"],
            ["dreams_and_analyses", "+ Analyses"],
          ] as Array<[Source, string]>
        ).map(([s, label]) => (
          <button
            key={s}
            className={source === s ? "segment segment-on" : "segment"}
            onClick={() => setSource(s)}
            disabled={busy}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.85rem" }}>
        {source === "dreams"
          ? "Trends drawn from what you actually said."
          : analyzedCount === 0
            ? "No dreams are analyzed yet — this will read the same as Dreams."
            : `Also reads each dream's latest analysis (${analyzedCount} analyzed). Richer, but it can find patterns in its own earlier readings.`}
      </p>

      <div className="seq" style={{ margin: "18px 0 8px" }}>Scope</div>

      <div className="segmented">
        {(
          [
            ["all", "All"],
            ["last_n", "Last N"],
            ["range", "Dates"],
          ] as Array<[Kind, string]>
        ).map(([k, label]) => (
          <button
            key={k}
            className={kind === k ? "segment segment-on" : "segment"}
            onClick={() => setKind(k)}
            disabled={busy}
          >
            {label}
          </button>
        ))}
      </div>

      {kind === "last_n" && (
        <div className="row" style={{ gap: 12, marginTop: 14 }}>
          <button
            className="btn stepper"
            onClick={() => setLastN((n) => Math.max(1, n - 1))}
            disabled={busy || lastN <= 1}
            aria-label="One fewer dream"
          >
            −
          </button>
          <div style={{ minWidth: 92, textAlign: "center" }}>
            <div className="metric">{lastN}</div>
            <div className="muted" style={{ fontSize: "0.8rem" }}>
              dream{lastN === 1 ? "" : "s"}
            </div>
          </div>
          <button
            className="btn stepper"
            onClick={() => setLastN((n) => Math.min(max, n + 1))}
            disabled={busy || lastN >= max}
            aria-label="One more dream"
          >
            +
          </button>
        </div>
      )}

      {kind === "range" && (
        <div style={{ marginTop: 14 }}>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-sm" onClick={() => applyPreset(7)} disabled={busy}>
              Past week
            </button>
            <button className="btn btn-sm" onClick={() => applyPreset(30)} disabled={busy}>
              Past month
            </button>
            <button className="btn btn-sm" onClick={() => applyPreset(365)} disabled={busy}>
              Past year
            </button>
          </div>
          <div className="row" style={{ gap: 12, marginTop: 12 }}>
            <label style={{ margin: 0, flex: 1 }}>
              From
              <input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => setFrom(e.target.value)}
                style={{ width: "100%", marginTop: 4 }}
              />
            </label>
            <label style={{ margin: 0, flex: 1 }}>
              To
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
                style={{ width: "100%", marginTop: 4 }}
              />
            </label>
          </div>
        </div>
      )}

      <p className="muted" style={{ margin: "14px 0 0", fontSize: "0.92rem" }}>
        {inScope.length === 0
          ? kind === "range" && !from && !to
            ? "Pick a start or end date."
            : "No dreams fall in that range."
          : `${scopeLabel(scope)} — ${inScope.length} dream${inScope.length === 1 ? "" : "s"} in this pass.`}
      </p>

      <button
        className="btn btn-primary btn-block btn-lg"
        style={{ marginTop: 12 }}
        onClick={run}
        disabled={!canRun}
      >
        {busy ? "Running a trend pass…" : "Run a trend pass"}
      </button>
      {error && (
        <div className="notice" style={{ marginTop: 12 }}>
          <div>{error}</div>
          {detail && (
            <details style={{ marginTop: 10, background: "none", border: "none", padding: 0 }}>
              <summary style={{ fontSize: "0.85rem", padding: "4px 0" }}>Details</summary>
              <div style={{ fontSize: "0.85rem", wordBreak: "break-word" }}>{detail}</div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
