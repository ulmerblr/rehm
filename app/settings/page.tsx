import Link from "next/link";
import { requireUserId } from "@/lib/session";
import { getActiveKeyInfo, getTokenTotal, getUserEmail } from "@/lib/queries";
import Header from "@/app/components/Header";
import Avatar from "@/app/components/Avatar";
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
      <Header right={<Link href="/">← Home</Link>} />
      <h1 style={{ margin: 0 }}>Settings</h1>

      {/* Profile — who you're signed in as. */}
      <div className="card row" style={{ gap: 14 }}>
        {email && <Avatar email={email} size={44} />}
        <div>
          <div style={{ fontWeight: 600 }}>{email ? email.split("@")[0] : "Account"}</div>
          {email && <div className="muted" style={{ fontSize: "0.9rem" }}>{email}</div>}
        </div>
      </div>

      {/* Usage — real money spent on your key; kept even if a dream is deleted. */}
      <h2>Usage</h2>
      <div className="card" style={{ marginTop: 0 }}>
        <div className="row" style={{ gap: 24 }}>
          <div>
            <div className="metric">{tokens.input.toLocaleString()}</div>
            <div className="muted" style={{ fontSize: "0.85rem" }}>input tokens</div>
          </div>
          <div>
            <div className="metric">{tokens.output.toLocaleString()}</div>
            <div className="muted" style={{ fontSize: "0.85rem" }}>output tokens</div>
          </div>
        </div>
        <p className="muted" style={{ fontSize: "0.9rem", margin: "12px 0 0" }}>
          Lifetime total across your restatements, analyses, and trend runs. This is a
          permanent record of what your key was billed — deleting a dream does not reduce it.
        </p>
      </div>

      {/* API key — needed to generate anything, but not the first thing you see. */}
      <h2>Anthropic API key</h2>
      {key ? (
        <div className="card" style={{ marginTop: 0 }}>
          <div>
            {key.label && <span className="tag">{key.label}</span>}
            <span className="tag">ends {key.lastFour}</span>
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            {key.lastVerifiedAt ? `Last worked: ${key.lastVerifiedAt}` : "Not yet used."}
          </div>
        </div>
      ) : (
        <p className="muted">
          No key on file. Add one to generate restatements, analyses, and trends.
        </p>
      )}
      <div style={{ marginTop: 12 }}>
        <KeyForm hasKey={!!key} />
      </div>

      <h2>Getting a key</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Create an API key at{" "}
        <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
          console.anthropic.com
        </a>{" "}
        — sign in, open <strong>API Keys</strong>, and click <strong>Create Key</strong>. You&apos;ll
        also need a little credit on that account under <strong>Billing</strong>. Calls you make in
        rehm are billed there, to you.
      </p>

      <h2>Account</h2>
      <form method="post" action="/api/auth/logout" style={{ marginTop: 8 }}>
        <button className="btn" type="submit">Sign out</button>
      </form>

      <h2>Maintenance</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Database migrations apply automatically on every deploy. This button is a
        fallback — use it only if something looks off.
      </p>
      <MigrateButton />
    </main>
  );
}
