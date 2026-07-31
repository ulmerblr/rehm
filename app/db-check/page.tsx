import { getSql } from "@/lib/db";

// Run server-side on every request so the check reflects live DB state.
export const dynamic = "force-dynamic";

export default async function DbCheck() {
  let version: string | null = null;

  try {
    const sql = getSql();
    // version() returns a plain text string, so no coercion needed here.
    const rows = (await sql`SELECT version()`) as Array<{ version: string }>;
    version = rows[0]?.version ?? null;
  } catch (error) {
    // Surface the real error to Vercel Runtime Logs without leaking it to
    // the page (the connection string could appear in some driver errors).
    console.error("db-check failed:", error);
    version = null;
  }

  if (!version) {
    return (
      <main>
        <h1>DB connection failed</h1>
        <p>Could not read the Postgres version. Check the Runtime Logs.</p>
      </main>
    );
  }

  return (
    <main>
      <h1>DB connection OK</h1>
      <p>{version}</p>
    </main>
  );
}
