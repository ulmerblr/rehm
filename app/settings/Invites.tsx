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
  /** Who redeemed it, already resolved to a display name by the server. */
  usedByName: string | null;
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
  const [confirming, setConfirming] = useState<string | null>(null);

  const linkFor = (code: string) => `${origin}/signup?invite=${encodeURIComponent(code)}`;

  const messageFor = (code: string) =>
    `You're invited to rehmchi — a private dream log.\n\n${linkFor(code)}\n\nInvite code: ${code}\n\nYou'll need your own Anthropic API key; anything it generates is billed to you.`;

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
      const res = await fetch(`/api/invites/${id}/revoke`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || `failed (${res.status})`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  // Removing the row outright. Revoking cancels a code that may still be in
  // someone's messages; this is the cleanup afterwards, and without it a
  // revoked invitation stays on the list forever with nothing left to do.
  async function remove(id: string) {
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
      setConfirming(null);
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
                      ? inv.usedByName
                        ? t.usedBy(inv.usedByName, inv.usedAt ? t.formatDate(inv.usedAt) : "")
                        : t.used(inv.usedAt ? t.formatDate(inv.usedAt) : "")
                      : t.revoked}
                </span>
              </div>

              {/* While a delete is being confirmed the row shows nothing but
                  the two answers to that question. Leaving copy and revoke
                  sitting alongside invites a mis-tap on the one control here
                  that can't be undone. */}
              {confirming === inv.id ? (
                <>
                  <p className="machine" style={{ marginTop: 12 }}>
                    {t.deleteInviteConfirm}
                  </p>
                  <div className="row" style={{ gap: 10, marginTop: 10 }}>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => remove(inv.id)}
                      disabled={busy}
                    >
                      {busy ? t.deleting : t.confirmDelete}
                    </button>
                    <button
                      className="linklike stamp"
                      onClick={() => setConfirming(null)}
                      disabled={busy}
                    >
                      {t.cancel}
                    </button>
                  </div>
                </>
              ) : (
                <div className="row" style={{ gap: 10, marginTop: 12 }}>
                  {inv.status === "open" && (
                    <>
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
                    </>
                  )}
                  <span className="row-end">
                    {inv.status === "open" && (
                      <button className="linklike stamp" onClick={() => revoke(inv.id)} disabled={busy}>
                        {t.revoke}
                      </button>
                    )}
                    <button
                      className="linklike stamp"
                      onClick={() => setConfirming(inv.id)}
                      disabled={busy}
                    >
                      {t.deleteInvite}
                    </button>
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
