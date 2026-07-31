export const dynamic = "force-dynamic";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main>
      <h1>rehm</h1>
      <p className="muted">Enter the access token to continue.</p>
      {error && <p className="notice">Incorrect token.</p>}
      <form method="post" action="/api/gate" className="stack" style={{ marginTop: 20 }}>
        <input
          type="password"
          name="token"
          autoFocus
          autoComplete="current-password"
          aria-label="Access token"
          placeholder="Access token"
        />
        <button className="btn btn-primary btn-block btn-lg" type="submit">
          Enter
        </button>
      </form>
    </main>
  );
}
