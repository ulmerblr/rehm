"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { dict } from "@/lib/i18n";
import type { Lang } from "@/lib/lang";

export type InviteRow = {
  id: string;
  code: string;
  status: "open" | "used" | "revoked";
  createdAt: string;
  usedAt: string | null;
};

// Issue and manage single-use invitations. The point of the screen is one
// paste-able message — the link carries the code, so the person you send it to
// doesn't have to retype anything.
export default function Invites({ invites, origin, lang }: { invites: InviteRow[]; origin: string; lang: Lang }) {
  const router = useRouter();
  const t = dict(lang);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const linkFor = (code: string) => `${origin}/signup?invite=${encodeURIComponent(code)}`;

  const messageFor = (code: string) =>
    `You're invited to rehm — a private dream log.\n\n${linkFor(code)}\n\nInvite code: ${code}\n\nYou'll need your own Anthropic API key; anything it generates is billed to you.`;

  async function copy(kind: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError(t.couldNotCopy);
    }
  }

  async function create() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || `failed (${res.status})`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/invites/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || `failed (${res.status})`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button className="btn" onClick={create} disabled={busy}>
        {busy ? t.working : t.createInvitation}
      </button>
      {error && <p className="notice" style={{ marginTop: 12 }}>{error}</p>}

      {invites.length > 0 && (
        <div style={{ marginTop: 20 }}>
          {invites.map((inv) => (
            <div key={inv.id} className="claim">
              <div className="row" style={{ justifyContent: "space-between", gap: 10 }}>
                <span className="run-dreams">{inv.code}</span>
                <span className={inv.status === "open" ? "stamp stamp-flag" : "stamp stamp-machine"}>
                  {inv.status === "open"
                    ? t.unused
                    : inv.status === "used"
                      ? t.used(inv.usedAt ? t.formatDate(inv.usedAt) : "")
                      : t.revoked}
                </span>
              </div>

              {inv.status === "open" && (
                <div className="row" style={{ gap: 10, marginTop: 12 }}>
                  <button
                    className="btn btn-sm"
                    onClick={() => copy(`msg-${inv.id}`, messageFor(inv.code))}
                  >
                    {copied === `msg-${inv.id}` ? t.copied : t.copyMessage}
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={() => copy(`link-${inv.id}`, linkFor(inv.code))}
                  >
                    {copied === `link-${inv.id}` ? t.copied : t.copyLink}
                  </button>
                  <button className="linklike stamp" onClick={() => revoke(inv.id)} disabled={busy}>
                    {t.revoke}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
