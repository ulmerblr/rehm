import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSql } from "@/lib/db";
import { SESSION_COOKIE, SESSION_MAX_AGE, makeSessionValue } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");

  const fail = () =>
    NextResponse.redirect(new URL("/login?error=1", req.url), { status: 303 });

  const sql = getSql();
  const rows = (await sql`
    SELECT id, password_hash FROM users WHERE email = ${email}
  `) as Array<{ id: string; password_hash: string }>;

  // Compare against a fixed valid bcrypt hash when the user is absent so timing
  // doesn't reveal whether the email exists. (Hash of a random string; never
  // matches a real password.)
  const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO3iVUQK6b2s5S6fJ0hR6uQ2m5o1qQ2mS";
  const hash = rows.length > 0 ? rows[0].password_hash : DUMMY_HASH;
  let ok = false;
  try {
    ok = await bcrypt.compare(password, hash);
  } catch {
    ok = false;
  }
  if (rows.length === 0 || !ok) return fail();

  const res = NextResponse.redirect(new URL("/", req.url), { status: 303 });
  res.cookies.set(SESSION_COOKIE, await makeSessionValue(rows[0].id), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
