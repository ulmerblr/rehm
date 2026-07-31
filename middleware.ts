import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieValue, timingSafeEqualStr } from "@/lib/gate";

// Gate every route except the login page and the gate-exchange endpoint (and
// static assets). Applies to preview deploys too. No page or API route below is
// reachable — and no raw_transcript is ever rendered — without a valid cookie.
export async function middleware(req: NextRequest) {
  const viewToken = process.env.VIEW_TOKEN;
  const cookie = req.cookies.get(SESSION_COOKIE)?.value ?? "";

  let authed = false;
  if (viewToken) {
    authed = timingSafeEqualStr(cookie, await sessionCookieValue(viewToken));
  }
  if (authed) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|api/gate|_next/static|_next/image|favicon.ico).*)"],
};
