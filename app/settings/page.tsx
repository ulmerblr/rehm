import { requireUserId } from "@/lib/session";
import { getActiveKeyInfo, getTokenTotal, getUserEmail, listInvites } from "@/lib/queries";
import { headers } from "next/headers";
import { resolveView } from "@/lib/viewLang";
import { quote } from "@/lib/backfill";
import { otherLang } from "@/lib/lang";
import KeyForm from "./KeyForm";
import LanguageSettings from "./LanguageSettings";
import MigrateButton from "./MigrateButton";
import Invites from "./Invites";

export const dynamic = "force-dynamic";

export default async function Settings() {
  const userId = await requireUserId();
  const view = await resolveView(userId);
  const t = view.t;
  const [key, tokens, email, invites] = await Promise.all([
    getActiveKeyInfo(userId),
    getTokenTotal(userId),
    getUserEmail(userId),
    listInvites(userId),
  ]);

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
          {key.label ? `${key.label} · ` : ""}ends {key.lastFour} ·{" "}
          {key.lastVerifiedAt ? `last worked ${key.lastVerifiedAt.slice(0, 10)}` : "not yet used"}
        </div>
      ) : (
        <p className="machine" style={{ marginTop: 0 }}>
          No key on file. Add one to generate restatements, analyses, and trends.
        </p>
      )}
      <KeyForm hasKey={!!key} />

      <h2>Getting a key</h2>
      <p className="machine" style={{ marginTop: 0 }}>
        Create an API key at{" "}
        <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
          console.anthropic.com
        </a>{" "}
        — sign in, open API keys, create one, and put a little credit on the account
        under billing. Calls made here are billed there, to you.
      </p>

      <h2>Invitations</h2>
      <p className="machine" style={{ marginTop: 0 }}>
        Each invitation works once. Copy the message, send it, and the link fills
        the code in for them.
      </p>
      <Invites invites={invites} origin={origin} />

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

      <h2>{t.maintenance}</h2>
      <p className="machine" style={{ marginTop: 0 }}>
        Migrations apply automatically on deploy. This is a fallback for when
        something looks wrong.
      </p>
      <MigrateButton />
    </main>
  );
}
