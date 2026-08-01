import { requireUserId } from "@/lib/session";
import { getActiveKeyInfo, getTokenTotal, getUserEmail } from "@/lib/queries";
import KeyForm from "./KeyForm";
import MigrateButton from "./MigrateButton";

export const dynamic = "force-dynamic";

export default async function Settings() {
  const userId = await requireUserId();
  const [key, tokens, email] = await Promise.all([
    getActiveKeyInfo(userId),
    getTokenTotal(userId),
    getUserEmail(userId),
  ]);

  return (
    <main>
      <h1>Settings</h1>

      <div className="stamp">{email ?? "account"}</div>

      <h2>Usage</h2>
      <div className="row" style={{ gap: 28, alignItems: "baseline" }}>
        <div>
          <div className="run-corpus">{tokens.input.toLocaleString()}</div>
          <div className="stamp stamp-machine" style={{ marginTop: 4 }}>
            input tokens
          </div>
        </div>
        <div>
          <div className="run-corpus">{tokens.output.toLocaleString()}</div>
          <div className="stamp stamp-machine" style={{ marginTop: 4 }}>
            output tokens
          </div>
        </div>
      </div>
      <p className="machine" style={{ marginTop: 14 }}>
        Lifetime total across restatements, analyses, and trend passes. This is what
        your key was billed — deleting a dream does not reduce it.
      </p>

      <h2>Anthropic API key</h2>
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

      <h2>Account</h2>
      <form method="post" action="/api/auth/logout">
        <button className="btn" type="submit">
          Sign out
        </button>
      </form>

      <h2>Maintenance</h2>
      <p className="machine" style={{ marginTop: 0 }}>
        Migrations apply automatically on deploy. This is a fallback for when
        something looks wrong.
      </p>
      <MigrateButton />
    </main>
  );
}
