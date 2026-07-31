import Link from "next/link";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  email: "Enter a valid email address.",
  password: "Password must be at least 8 characters.",
  exists: "An account with that email already exists.",
};

export default async function Signup({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main>
      <h1>rehm</h1>
      <p className="muted">Create an account.</p>
      {error && <p className="notice">{ERRORS[error] ?? "Something went wrong."}</p>}

      <form method="post" action="/api/auth/signup" className="stack" style={{ marginTop: 18 }}>
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" type="text" name="email" autoComplete="email" inputMode="email" />
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
          <label htmlFor="password">Password</label>
          <input id="password" type="password" name="password" autoComplete="new-password" />
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
