import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { MODEL } from "@/lib/config";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { persistNewKey } from "@/lib/keys";
import { userFacingAnthropicError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Save (or replace) the session user's Anthropic key. Verified with one cheap
// call before storing — invalid keys are rejected at entry, not at 6am. The
// full key is never stored in plaintext and never returned.
export async function POST(req: NextRequest) {
  const userId = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { apiKey?: string; label?: string };
  const apiKey = (body.apiKey ?? "").trim();
  const label = (body.label ?? "").trim() || null;

  if (!apiKey) {
    return NextResponse.json({ error: "empty", message: "Enter your API key." }, { status: 400 });
  }

  // Verify auth with a cheap call (no tokens billed).
  try {
    await new Anthropic({ apiKey }).models.retrieve(MODEL);
  } catch (err) {
    const m = userFacingAnthropicError(err);
    // At entry, phrase it as a key problem.
    const message =
      m.status === 401 ? "That API key isn't valid. Check it and try again." : m.message;
    return NextResponse.json({ error: "invalid_key", message }, { status: 400 });
  }

  const { lastFour } = await persistNewKey(userId, apiKey, label);
  return NextResponse.json({ ok: true, lastFour });
}
