import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSql } from "@/lib/db";
import { SESSION_COOKIE, SESSION_MAX_AGE, makeSessionValue } from "@/lib/auth";
import { normalizeInviteCode } from "@/lib/invites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_WINDOW_MIN = 10;
const RATE_MAX = 10; // attempts per IP per window

function back(req: NextRequest, error: string) {
  return NextResponse.redirect(new URL(`/signup?error=${error}`, req.url), { status: 303 });
}

function clientIp(req: NextRequest): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
}

export async function POST(req: NextRequest) {
  const missing = ["DATABASE_URL", "SESSION_SECRET"].filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error("signup misconfigured — missing env:", missing.join(", "));
    return back(req, "config");
  }

  // Tracked outside the try so a failure anywhere downstream can hand the
  // invitation back instead of burning it.
  let claimedInviteId: string | null = null;

  try {
    const sql = getSql();

    // Rate limit by IP (best-effort — skip silently if the table isn't there
    // yet, so signup still works before 0006 is applied).
    try {
      const ip = clientIp(req);
      await sql`INSERT INTO signup_attempts (ip) VALUES (${ip})`;
      const [{ n }] = (await sql`
        SELECT count(*)::int AS n FROM signup_attempts
        WHERE ip = ${ip} AND created_at > now() - make_interval(mins => ${RATE_WINDOW_MIN})
      `) as Array<{ n: number }>;
      if (Number(n) > RATE_MAX) return back(req, "invalid");
    } catch (e) {
      console.error("signup rate-limit skipped:", e instanceof Error ? e.message : e);
    }

    const form = await req.formData();
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const code = String(form.get("code") ?? "");

    if (!EMAIL_RE.test(email)) return back(req, "invalid");
    if (password.length < 8) return back(req, "invalid");

    // Claim the invitation before creating anything. The conditional UPDATE is
    // the claim, so two people redeeming the same code at once can't both win —
    // exactly one gets the row back.
    const claimed = (await sql`
      UPDATE invites SET used_at = now()
      WHERE code = ${normalizeInviteCode(code)}
        AND used_at IS NULL AND revoked_at IS NULL
      RETURNING id
    `) as Array<{ id: string }>;
    if (claimed.length === 0) return back(req, "invite");
    claimedInviteId = claimed[0].id;

    const passwordHash = await bcrypt.hash(password, 12);
    const inserted = (await sql`
      INSERT INTO users (email, password_hash)
      VALUES (${email}, ${passwordHash})
      ON CONFLICT (email) DO NOTHING
      RETURNING id
    `) as Array<{ id: string }>;

    if (inserted.length === 0) {
      // Email already taken — release the invitation so it isn't burned by a
      // failed attempt.
      await releaseInvite(claimedInviteId);
      claimedInviteId = null;
      return back(req, "invalid");
    }

    await sql`UPDATE invites SET used_by = ${inserted[0].id} WHERE id = ${claimedInviteId}`;
    claimedInviteId = null; // redeemed for real; nothing to give back

    const res = NextResponse.redirect(new URL("/", req.url), { status: 303 });
    res.cookies.set(SESSION_COOKIE, await makeSessionValue(inserted[0].id), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return res;
  } catch (err) {
    console.error("signup failed:", err instanceof Error ? err.message : err);
    await releaseInvite(claimedInviteId);
    return back(req, "server");
  }
}

// Best effort: if this fails too, the invitation stays spent, which is the safe
// direction to fail in.
async function releaseInvite(id: string | null) {
  if (!id) return;
  try {
    await getSql()`UPDATE invites SET used_at = NULL WHERE id = ${id} AND used_by IS NULL`;
  } catch (e) {
    console.error("invite release failed:", e instanceof Error ? e.message : e);
  }
}
