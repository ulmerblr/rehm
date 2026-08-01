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
        <span
          role="img"
          aria-label="rehm"
          style={{
            display: "inline-block",
            width: 148,
            height: 44,
            background: "var(--said)",
            WebkitMask: "url(/wordmark-mono.svg) no-repeat center / contain",
            mask: "url(/wordmark-mono.svg) no-repeat center / contain",
          }}
        />
      </div>
      <p className="machine">Create an account. Invite only.</p>

      <p style={{ lineHeight: 1.5 }}>
        Sign-up requires your own LLM API key. Those API calls are billed to your own account. There
        is no admin feature. There is no password reset. I can&apos;t see anything, so if you lose
        it, the account is gone.
      </p>

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
