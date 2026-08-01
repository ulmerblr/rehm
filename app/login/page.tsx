import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message =
    error === "config"
      ? "The site isn't fully configured yet. Please try again shortly."
      : "Email or password is incorrect.";
  return (
    <main>
      <div style={{ textAlign: "center", margin: "24px 0 28px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/lockup.png" alt="rehmchi" className="lockup lockup-lg" />
      </div>
      <p className="machine">Sign in.</p>
      {error && <p className="notice">{message}</p>}
      <form method="post" action="/api/auth/login" className="stack" style={{ marginTop: 18 }}>
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" type="text" name="email" autoComplete="email" inputMode="email" />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input id="password" type="password" name="password" autoComplete="current-password" />
        </div>
        <button className="btn btn-primary btn-block btn-lg" type="submit">
          Sign in
        </button>
      </form>

      <p className="muted" style={{ marginTop: 18, fontSize: "0.95rem" }}>
        There is no password reset. rehmchi has no email layer and no operator recovery path, so a
        forgotten password means the account — and its dreams — are gone for good. Keep your
        password somewhere safe.
      </p>
      <p style={{ marginTop: 14 }}>
        New here? <Link href="/signup">Create an account</Link>
      </p>
    </main>
  );
}
