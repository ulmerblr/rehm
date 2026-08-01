"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { dict } from "@/lib/i18n";
import type { Lang } from "@/lib/lang";
import type { AccountRow } from "@/lib/queries";

/**
 * The owner's list of accounts, with deletion.
 *
 * Shown only to the owner — the first account to exist. Deleting is a two-tap
 * confirm that names the email and the dream count, because the one thing you
 * need to know before erasing an account is how much is inside it, and the one
 * mistake worth preventing is deleting the wrong row from a list of similar
 * addresses.
 */
export default function Accounts({
  accounts,
  lang,
}: {
  accounts: AccountRow[];
  lang: Lang;
}) {
  const router = useRouter();
  const t = dict(lang);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function remove(id: string) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/accounts/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.error || `failed (${res.status})`);
      setDone(t.deleteAccountDone(String(data.email ?? "")));
      setConfirming(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="machine" style={{ marginTop: 0 }}>
        {t.accountsNote}
      </p>

      {done && (
        <p className="stamp stamp-machine" style={{ marginTop: 12 }}>
          {done}
        </p>
      )}

      <div style={{ marginTop: 16 }}>
        {accounts.map((a) => (
          <div key={a.id} className="claim">
            <div style={{ wordBreak: "break-all" }}>{a.email}</div>
            <div className="row" style={{ gap: 12, marginTop: 6 }}>
              <span className="stamp stamp-machine">
                {a.role === "owner" ? t.owner : t.member}
              </span>
              <span className="stamp stamp-machine">{t.dreamsCount(a.dreams)}</span>
              <span className="stamp stamp-machine">{t.formatDate(a.createdAt)}</span>
            </div>

            {/* The owner can't be removed: an instance with nobody to administer
                it has no way back, and there is no console to fix it from. */}
            {a.role !== "owner" && !a.isSelf && (
              <div style={{ marginTop: 12 }}>
                {confirming === a.id ? (
                  <>
                    <p className="notice" style={{ marginTop: 0 }}>
                      {t.deleteAccountConfirm(a.email, a.dreams)}
                    </p>
                    <div className="row" style={{ gap: 10 }}>
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={busy}
                        onClick={() => remove(a.id)}
                      >
                        {busy ? t.deleting : t.confirmDelete}
                      </button>
                      <button
                        className="linklike stamp"
                        disabled={busy}
                        onClick={() => setConfirming(null)}
                      >
                        {t.cancel}
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    className="linklike stamp"
                    disabled={busy}
                    onClick={() => {
                      setError(null);
                      setDone(null);
                      setConfirming(a.id);
                    }}
                  >
                    {t.deleteAccount}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {error && (
        <p className="notice" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}
    </div>
  );
}
