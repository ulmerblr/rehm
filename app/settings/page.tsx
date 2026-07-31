import Link from "next/link";
import { requireUserId } from "@/lib/session";
import { getActiveKeyInfo, getTokenTotal, getUserEmail } from "@/lib/queries";
import KeyForm from "./KeyForm";

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
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>Settings</h1>
        <Link href="/">← Dreams</Link>
      </div>
      {email && <p className="muted">{email}</p>}

      <h2>Anthropic API key</h2>
      {key ? (
        <div className="card">
          <div>
            {key.label && <span className="tag">{key.label}</span>}
            <span className="tag">ends {key.lastFour}</span>
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            {key.lastVerifiedAt
              ? `Last worked: ${key.lastVerifiedAt}`
              : "Not yet used."}
          </div>
        </div>
      ) : (
        <p className="muted">No key on file. Add one to generate restatements, analyses, and trends.</p>
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

      <h2>Usage</h2>
      <p>
        <span className="tag">input: {tokens.input.toLocaleString()} tokens</span>
        <span className="tag">output: {tokens.output.toLocaleString()} tokens</span>
      </p>
      <p className="muted" style={{ fontSize: "0.9rem" }}>
        Total tokens across your restatements, analyses, and trend runs.
      </p>

      <h2>Account</h2>
      <form method="post" action="/api/auth/logout" style={{ marginTop: 8 }}>
        <button className="btn" type="submit">Sign out</button>
      </form>
    </main>
  );
}
