import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { getLangSettings } from "@/lib/translations";
import { quote } from "@/lib/backfill";
import { isLang, otherLang } from "@/lib/lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// What this account writes in, whether it prepares both, and — if it doesn't
// yet — what turning that on would cost. The quote is arithmetic over stored
// character counts, so asking the price never spends anything.
export async function GET(req: NextRequest) {
  const userId = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const settings = await getLangSettings(userId);
  let pending = { items: 0, usd: 0 };
  try {
    const q = await quote(userId, otherLang(settings.language));
    pending = { items: q.items, usd: q.usd };
  } catch {
    // Schema not applied yet — report nothing pending rather than failing.
  }
  return NextResponse.json({ ...settings, pending });
}

// Change the account language, the dual setting, or both.
//
// Changing the account language does NOT rewrite anything: dreams already
// recorded stay in the language they were spoken in, permanently. It only
// governs what gets made from here on.
export async function POST(req: NextRequest) {
  const userId = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    language?: unknown;
    dual?: unknown;
  };

  const sql = getSql();
  try {
    if (isLang(body.language)) {
      await sql`UPDATE users SET language = ${body.language} WHERE id = ${userId}`;
    }
    if (typeof body.dual === "boolean") {
      // Turning it off never deletes translations. They were paid for; keeping
      // them means turning it back on later costs nothing.
      await sql`UPDATE users SET dual_language = ${body.dual} WHERE id = ${userId}`;
    }
  } catch (err) {
    return NextResponse.json(
      { error: "server", message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }

  const settings = await getLangSettings(userId);
  let pending = { items: 0, usd: 0 };
  try {
    const q = await quote(userId, otherLang(settings.language));
    pending = { items: q.items, usd: q.usd };
  } catch {
    /* schema not applied */
  }
  return NextResponse.json({ ok: true, ...settings, pending });
}
