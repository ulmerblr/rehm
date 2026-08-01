import type { Metadata } from "next";
import { Spectral, Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Three faces, three jobs. Provenance is encoded in type: testimony is set in
// the serif, machine-generated prose in the sans, and anything that is a
// measurement or a stamp in the mono.
const spectral = Spectral({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-said",
  display: "swap",
});
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ui",
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-data",
  display: "swap",
});
import { ensureMigrated, type MigrateResult } from "@/lib/migrate";
import BottomNav from "@/app/components/BottomNav";
import AppBar from "@/app/components/AppBar";

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

// A failed migration is surfaced as a banner ABOVE the app, never instead of
// it. Blocking the whole UI on a schema problem is what turned a bad migration
// into a total outage; the queries degrade on their own, so let the app run.
function MigrationBanner({
  file,
  error,
  applied,
}: {
  file?: string;
  error?: string;
  applied: string[];
}) {
  return (
    <details className="notice" style={{ marginBottom: 18 }}>
      <summary className="stamp stamp-flag">
        A schema update didn&apos;t apply — tap for details
      </summary>
      <div style={{ padding: "4px 0 12px" }}>
        <div className="stamp">Failed migration</div>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>{file ?? "(unknown)"}</div>
        <div className="stamp">Postgres error</div>
        <div className="turn-machine" style={{ marginTop: 6, marginBottom: 10 }}>
          {error ?? "(no error text)"}
        </div>
        <div className="stamp">Applied ({applied.length})</div>
        <div style={{ fontSize: "0.85rem" }}>
          {applied.length ? applied.join(", ") : "(none)"}
        </div>
      </div>
    </details>
  );
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const migration = await autoMigrate();
  return (
    <html lang="en" className={`${spectral.variable} ${archivo.variable} ${plexMono.variable}`}>
      <body>
        <AppBar />
        <div className="container">
          {migration.status === "failed" && (
            <MigrationBanner
              file={migration.file}
              error={migration.error}
              applied={migration.applied}
            />
          )}
          {children}
        </div>
        <BottomNav />
      </body>
    </html>
  );
}
