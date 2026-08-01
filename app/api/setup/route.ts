import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { isLang } from "@/lib/lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Finish first-run setup: record the account language, whether it prepares
// both, and that the screen has been answered.
//
// The language is required here rather than defaulted, because a default is
// exactly the failure this screen exists to prevent — an account drifting into
// English and capturing its first dreams under a recognizer that isn't
// listening for the right language.
export async function POST(req: NextRequest) {
  const userId = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { language?: unknown; dual?: unknown };
  if (!isLang(body.language)) {
    return NextResponse.json(
      { error: "language", message: "Pick a language first." },
      { status: 400 }
    );
  }
  const dual = body.dual === true;

  try {
    await getSql()`
      UPDATE users
      SET language = ${body.language}, dual_language = ${dual}, onboarded_at = now()
      WHERE id = ${userId}
    `;
  } catch (err) {
    return NextResponse.json(
      { error: "server", message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
