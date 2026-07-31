import { join } from "node:path";
import { getSql } from "@/lib/db";
import { hasValidBearer } from "@/lib/gate";
import { seedFromFiles } from "@/scripts/seed.mjs";

// Admin-only, server-side seed. Runs on Vercel using the rehm_app DATABASE_URL
// already in the environment; reads the committed seed/ files (see
// outputFileTracingIncludes in next.config.ts). Node runtime for fs + crypto.
//
// This route writes into a table the app role can never delete from. It is
// fail-closed: it refuses (409) if the subject's corpus is non-empty, and it
// is meant to be DELETED (with SEED_TOKEN removed from the env) once the seed
// is confirmed.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const token = process.env.SEED_TOKEN;
  if (!token) {
    return Response.json({ error: "SEED_TOKEN is not configured" }, { status: 500 });
  }
  if (!hasValidBearer(request, token)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const sql = getSql();

    // Defense in depth: seeding must run as the app role, never the owner.
    const [{ current_user: currentUser }] = (await sql`SELECT current_user`) as Array<{
      current_user: string;
    }>;
    if (currentUser !== "rehm_app") {
      return Response.json(
        { error: `seed must run as rehm_app, not "${currentUser}"` },
        { status: 403 }
      );
    }

    const summary = await seedFromFiles(sql, join(process.cwd(), "seed"));
    // Read-back fidelity failure returns 500 with the full table so it is never
    // mistaken for success.
    return Response.json(summary, { status: summary.ok ? 200 : 500 });
  } catch (err) {
    console.error("seed route failed:", err);
    const status =
      err && typeof err === "object" && "status" in err
        ? (err.status as number)
        : 400;
    const message = err instanceof Error ? err.message : "seed failed";
    return Response.json({ ok: false, error: message }, { status });
  }
}
