import Link from "next/link";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  invalid: "Sign-up failed. Check your email, password, and invite code, then try again.",
  config: "The site isn't fully configured yet. Please try again shortly.",
  server: "Something went wrong. If this persists, the database may not be set up yet.",
};

export default async function Signup({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main>
      <div style={{ textAlign: "center", margin: "24px 0 28px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/wordmark-light.svg" alt="rehm" style={{ height: 44, display: "inline-block" }} />
      </div>
      <p className="muted">Create an account. Invite only.</p>
      {error && <p className="notice">{ERRORS[error] ?? ERRORS.invalid}</p>}

      <form method="post" action="/api/auth/signup" className="stack" style={{ marginTop: 18 }}>
        <div>
          <label htmlFor="code">Invite code</label>
          <input id="code" type="text" name="code" autoComplete="off" required />
        </div>
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" type="text" name="email" autoComplete="email" inputMode="email" required />
        </div>

        {/* Honesty notice — plain on the page, directly above the password field. */}
        <p
          className="card"
          style={{ background: "var(--surface-2)", fontSize: "0.98rem", lineHeight: 1.5 }}
        >
          Your dreams are stored in this app&apos;s database. There is no admin view — no one can
          read your dreams through rehm. The person running it holds the database credential and
          could read them directly; he doesn&apos;t. Your password is hashed and is not recoverable
          by anyone. API calls are billed to your own Anthropic account.
        </p>

        <div>
          <label htmlFor="password">Password (at least 8 characters)</label>
          <input
            id="password"
            type="password"
            name="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <button className="btn btn-primary btn-block btn-lg" type="submit">
          Create account
        </button>
      </form>
      <p style={{ marginTop: 18 }}>
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </main>
  );
}
