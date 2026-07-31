import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

// Every route requires a valid native-auth session, except the auth pages and
// auth endpoints (and static assets). Applies to preview deploys too. No page
// or API route renders any user data without a verified session; the user id
// is derived from the signed cookie server-side, never from the client.
export async function middleware(req: NextRequest) {
  const userId = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (userId) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!login|signup|api/auth/login|api/auth/signup|_next/static|_next/image|favicon.ico).*)",
  ],
};
