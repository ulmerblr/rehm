import type { Metadata } from "next";
import "./globals.css";
import { ensureMigrated } from "@/lib/migrate";

export const metadata: Metadata = {
  metadataBase: new URL("https://rehm.xyzroot.com"),
  title: "rehm",
  description: "rehm",
};

// The root layout renders (in the Node.js runtime) for every route, so this is
// the earliest reliable place to apply pending migrations automatically. It is
// memoized in lib/migrate, so it does real work only once per server instance —
// on the first request after a deploy — and is a no-op thereafter. A failure is
// logged and never blocks rendering; the Settings button is the fallback.
async function autoMigrate() {
  // Never migrate during `next build` (static prerender of /_not-found etc.
  // renders this layout, and the Vercel build env may carry DATABASE_URL) —
  // only at request time on the live server.
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) return;
  try {
    const result = await ensureMigrated();
    if (!result.ok) {
      const failed = result.results.find((r) => !r.ok);
      console.error(`[rehm] auto-migrate failed at ${failed?.file}: ${failed?.error}`);
    } else {
      const applied = result.results.filter((r) => r.ok && !r.skipped).map((r) => r.file);
      if (applied.length > 0) console.log(`[rehm] applied migrations: ${applied.join(", ")}`);
    }
  } catch (err) {
    console.error(
      `[rehm] auto-migrate errored: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await autoMigrate();
  return (
    <html lang="en">
      <body>
        <div className="container">{children}</div>
      </body>
    </html>
  );
}
