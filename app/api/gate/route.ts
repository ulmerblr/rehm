import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieValue, timingSafeEqualStr } from "@/lib/gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Exchange the shared VIEW_TOKEN for a signed session cookie.
export async function POST(req: NextRequest) {
  const viewToken = process.env.VIEW_TOKEN;
  const form = await req.formData();
  const provided = String(form.get("token") ?? "");

  if (!viewToken || !timingSafeEqualStr(provided, viewToken)) {
    return NextResponse.redirect(new URL("/login?error=1", req.url), {
      status: 303,
    });
  }

  const res = NextResponse.redirect(new URL("/", req.url), { status: 303 });
  res.cookies.set(SESSION_COOKIE, await sessionCookieValue(viewToken), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
