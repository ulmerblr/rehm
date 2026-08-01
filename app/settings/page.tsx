import { requireUserId } from "@/lib/session";
import {
  getActiveKeyInfo,
  getTokenTotal,
  getUserEmail,
  inviteStandings,
  listAccounts,
  listInvites,
} from "@/lib/queries";
import { headers } from "next/headers";
import { resolveView } from "@/lib/viewLang";
import { quote } from "@/lib/backfill";
import { otherLang } from "@/lib/lang";
import { displayNames } from "@/lib/names";
import KeyForm from "./KeyForm";
import LanguageSettings from "./LanguageSettings";
import Accounts from "./Accounts";
import MigrateButton from "./MigrateButton";
import Invites from "./Invites";

export const dynamic = "force-dynamic";

export default async function Settings() {
  const userId = await requireUserId();
  const view = await resolveView(userId);
  const t = view.t;
  const [key, tokens, email, invites, standings, accounts] = await Promise.all([
    getActiveKeyInfo(userId),
    getTokenTotal(userId),
    getUserEmail(userId),
    listInvites(userId),
    inviteStandings(userId),
    // Only the owner sees this, so only the owner pays for the query.
    view.isOwner ? listAccounts(userId) : Promise.resolve([]),
  ]);

  // Names are resolved here rather than in the components, so the addresses
  // they're derived from stay on the server. The standings are the one screen
  // a member sees other people on, and a tally doesn't need anyone's address.
  const standingNames = displayNames(standings.map((s) => s.email));
  const inviteNames = displayNames(
    invites.map((i) => i.usedByEmail).filter((e): e is string => e !== null)
  );

  let pending = { items: 0, usd: 0 };
  try {
    const q = await quote(userId, otherLang(view.accountLang));
    pending = { items: q.items, usd: q.usd };
  } catch {
    // 0018 not applied yet — the section still renders, with nothing pending.
  }

  // Build the invite link against whatever host this is actually served on, so
  // a copied link works from a preview deploy as well as production.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : "";

  return (
    <main>
      <h1>{t.settings}</h1>

      <div className="stamp">{email ?? "account"}</div>

      <h2>{t.usage}</h2>
      <div className="row" style={{ gap: 28, alignItems: "baseline" }}>
        <div>
          <div className="run-corpus">{tokens.input.toLocaleString()}</div>
          <div className="stamp stamp-machine" style={{ marginTop: 4 }}>
            {t.inputTokens}
          </div>
        </div>
        <div>
          <div className="run-corpus">{tokens.output.toLocaleString()}</div>
          <div className="stamp stamp-machine" style={{ marginTop: 4 }}>
            {t.outputTokens}
          </div>
        </div>
      </div>
      <p className="machine" style={{ marginTop: 14 }}>
        {t.usageNote}
      </p>

      <h2>{t.apiKey}</h2>
      {key ? (
        <div className="stamp" style={{ marginBottom: 14 }}>
          {t.keyEnds(
            key.label ?? "",
            key.lastFour,
            key.lastVerifiedAt ? t.formatDate(key.lastVerifiedAt) : t.notYetUsed
          )}
        </div>
      ) : (
        <p className="machine" style={{ marginTop: 0 }}>
          {t.noKeyOnFile}
        </p>
      )}
      <KeyForm hasKey={!!key} lang={view.lang} />

      <h2>{t.gettingAKey}</h2>
      <p className="machine" style={{ marginTop: 0 }}>
        Create an API key at{" "}
        <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
          console.anthropic.com
        </a>{" "}
        — {t.gettingAKeyNote}
      </p>

      <h2>{t.invitations}</h2>
      <p className="machine" style={{ marginTop: 0 }}>
        {t.invitationsNote}
      </p>
      <Invites
        invites={invites.map((i) => ({
          id: i.id,
          code: i.code,
          status: i.status,
          createdAt: i.createdAt,
          usedAt: i.usedAt,
          usedByName: i.usedByEmail ? (inviteNames.get(i.usedByEmail) ?? null) : null,
        }))}
        origin={origin}
        lang={view.lang}
      />

      {/* Hidden until someone has actually brought someone: a standings table
          of one row with a 1 in it is not a standings table. */}
      {standings.length > 0 && (
        <>
          <h2>{t.whoInvitedWhom}</h2>
          <p className="machine" style={{ marginTop: 0 }}>
            {t.standingsNote}
          </p>
          <div style={{ marginTop: 16 }}>
            {standings.map((s) => (
              <div key={s.email} className="claim">
                <div className="row" style={{ justifyContent: "space-between", gap: 10 }}>
                  {/* Your own row stays at full strength; everyone else's is
                      dimmed, so you find yourself without needing a marker
                      that shouts. */}
                  <span className={s.isSelf ? undefined : "muted"}>
                    {standingNames.get(s.email) ?? s.email}
                    {s.isSelf && (
                      <span className="stamp stamp-machine">{` — ${t.youMarker}`}</span>
                    )}
                  </span>
                  <span className="stamp stamp-machine">{t.broughtCount(s.invited)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <h2>{t.language}</h2>
      <LanguageSettings
        initial={{ language: view.accountLang, dual: view.dual, pending }}
        viewLang={view.lang}
      />

      <h2>{t.account}</h2>
      <form method="post" action="/api/auth/logout">
        <button className="btn" type="submit">
          {t.signOut}
        </button>
      </form>

      {/* Administering the instance. Everything below belongs to the account
          that stood it up: the roster of accounts, and the schema. A member's
          settings page ends at Account — they can still invite people, which
          is the one administrative thing that is genuinely everyone's. */}
      {view.isOwner && (
        <>
          {accounts.length > 0 && (
            <>
              <h2>{t.accounts}</h2>
              <Accounts accounts={accounts} lang={view.lang} />
            </>
          )}

          <h2>{t.maintenance}</h2>
          <p className="machine" style={{ marginTop: 0 }}>
            {t.maintenanceNote}
          </p>
          <MigrateButton lang={view.lang} />
        </>
      )}
    </main>
  );
}
