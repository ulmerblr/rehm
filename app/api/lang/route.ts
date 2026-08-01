import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { VIEW_LANG_COOKIE, isLang } from "@/lib/lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Flip the view language. This changes what is displayed and nothing else —
// the account's own language, and therefore what future dreams are dictated
// and analysed in, is set in Settings and is untouched here.
//
// Deliberately a session cookie with no maxAge: the toggle is a lens someone
// reaches for when handing over the phone, not a preference. Close the app and
// it returns to the account's language on its own.
export async function POST(req: NextRequest) {
  const userId = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { lang?: unknown };
  if (!isLang(body.lang)) {
    return NextResponse.json({ error: "bad_lang" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true, lang: body.lang });
  res.cookies.set(VIEW_LANG_COOKIE, body.lang, {
    httpOnly: false,
    secure: true,
    sameSite: "lax",
    path: "/",
  });
  return res;
}
