import { join } from "node:path";
import { getSql } from "@/lib/db";
import { seedFromFiles } from "@/scripts/seed.mjs";

// Admin-only, server-side seed. Runs on Vercel using the rehm_app DATABASE_URL
// already in the environment; reads the committed seed/ files (see
// outputFileTracingIncludes in next.config.ts). Node runtime for fs access.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const token = process.env.SEED_TOKEN;
  if (!token) {
    return Response.json(
      { error: "SEED_TOKEN is not configured" },
      { status: 500 }
    );
  }

  // Gate: Authorization: Bearer <SEED_TOKEN> (or x-seed-token header).
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.headers.get("x-seed-token") ??
    "";
  if (provided !== token) {
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
    return Response.json({ ok: true, ...summary });
  } catch (err) {
    console.error("seed route failed:", err);
    const message = err instanceof Error ? err.message : "seed failed";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
