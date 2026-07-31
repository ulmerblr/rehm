import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSql } from "@/lib/db";
import { SIGNUP_CODE } from "@/lib/config";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  makeSessionValue,
  timingSafeEqualStr,
} from "@/lib/auth";

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

    // Invite code: constant-time, checked before any user row is created. A
    // wrong code returns the same generic failure as any other signup error —
    // it does not reveal that the code was the problem.
    if (!timingSafeEqualStr(code, SIGNUP_CODE)) return back(req, "invalid");
    if (!EMAIL_RE.test(email)) return back(req, "invalid");
    if (password.length < 8) return back(req, "invalid");

    const passwordHash = await bcrypt.hash(password, 12);
    const inserted = (await sql`
      INSERT INTO users (email, password_hash)
      VALUES (${email}, ${passwordHash})
      ON CONFLICT (email) DO NOTHING
      RETURNING id
    `) as Array<{ id: string }>;
    if (inserted.length === 0) return back(req, "invalid");

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
    return back(req, "server");
  }
}
