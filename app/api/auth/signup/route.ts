import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSql } from "@/lib/db";
import { SESSION_COOKIE, SESSION_MAX_AGE, makeSessionValue } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function back(req: NextRequest, error: string) {
  return NextResponse.redirect(new URL(`/signup?error=${error}`, req.url), { status: 303 });
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");

  if (!EMAIL_RE.test(email)) return back(req, "email");
  if (password.length < 8) return back(req, "password");

  const passwordHash = await bcrypt.hash(password, 12);
  const sql = getSql();
  // Password is never recoverable: only the bcrypt hash is stored.
  const inserted = (await sql`
    INSERT INTO users (email, password_hash)
    VALUES (${email}, ${passwordHash})
    ON CONFLICT (email) DO NOTHING
    RETURNING id
  `) as Array<{ id: string }>;
  if (inserted.length === 0) return back(req, "exists");

  const res = NextResponse.redirect(new URL("/", req.url), { status: 303 });
  res.cookies.set(SESSION_COOKIE, await makeSessionValue(inserted[0].id), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
