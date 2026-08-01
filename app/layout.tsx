import type { Metadata } from "next";
import "./globals.css";
import { ensureMigrated, type MigrateResult } from "@/lib/migrate";

export const metadata: Metadata = {
  metadataBase: new URL("https://rehm.xyzroot.com"),
  title: "rehm",
  description: "rehm",
};

// The root layout renders (in the Node.js runtime) for every route, so this is
// the earliest reliable place to apply pending migrations automatically. It is
// memoized in lib/migrate, so it does real work only once per server instance,
// and (since a failed run is not memoized) retries on the next request until it
// succeeds. Returns the result so the layout can show a readable diagnostic
// instead of letting a page crash on a table a failed migration never created.
type Diag =
  | { status: "ok" | "skipped" }
  | { status: "failed"; file?: string; error?: string; applied: string[] };

async function autoMigrate(): Promise<Diag> {
  if (process.env.NEXT_PHASE === "phase-production-build") return { status: "skipped" };
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) return { status: "skipped" };
  try {
    const result: MigrateResult = await ensureMigrated();
    if (!result.ok) {
      const failed = result.results.find((r) => !r.ok);
      const applied = [
        ...result.alreadyApplied,
        ...result.results.filter((r) => r.ok).map((r) => r.file),
      ];
      console.error(`[rehm] auto-migrate failed at ${failed?.file}: ${failed?.error}`);
      return { status: "failed", file: failed?.file, error: failed?.error, applied };
    }
    const applied = result.results.filter((r) => r.ok && !r.skipped).map((r) => r.file);
    if (applied.length > 0) console.log(`[rehm] applied migrations: ${applied.join(", ")}`);
    return { status: "ok" };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[rehm] auto-migrate errored: ${error}`);
    return { status: "failed", error, applied: [] };
  }
}

function MigrationDiagnostic({
  file,
  error,
  applied,
}: {
  file?: string;
  error?: string;
  applied: string[];
}) {
  return (
    <main>
      <h1 style={{ marginBottom: 8 }}>Setting up the database…</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        A schema update didn&apos;t apply cleanly, so the app is paused to avoid showing
        broken data. It retries automatically — here is exactly what failed:
      </p>
      <div className="card">
        <div className="seq">Failed migration</div>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>{file ?? "(unknown)"}</div>
        <div className="seq">Postgres error</div>
        <div className="verbatim" style={{ marginTop: 6 }}>{error ?? "(no error text)"}</div>
      </div>
      <div className="card">
        <div className="seq">Already applied ({applied.length})</div>
        <div style={{ marginTop: 6, fontSize: "0.9rem" }}>
          {applied.length ? applied.join(", ") : "(none)"}
        </div>
      </div>
      <p className="muted">Reload in a moment, or send this screen to have it fixed.</p>
    </main>
  );
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const migration = await autoMigrate();
  return (
    <html lang="en">
      <body>
        <div className="container">
          {migration.status === "failed" ? (
            <MigrationDiagnostic
              file={migration.file}
              error={migration.error}
              applied={migration.applied}
            />
          ) : (
            children
          )}
        </div>
      </body>
    </html>
  );
}
