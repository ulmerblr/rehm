import Link from "next/link";
import { requireUserId } from "@/lib/session";
import { nextSequenceNo } from "@/lib/queries";
import RecordFlow from "./RecordFlow";
import { resolveView } from "@/lib/viewLang";

export const dynamic = "force-dynamic";

export default async function Record() {
  const userId = await requireUserId();
  const seq = await nextSequenceNo(userId);
  const today = new Date().toISOString().slice(0, 10);
  const view = await resolveView(userId);

  return (
    <main>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>{view.t.recordADream}</h1>
        <Link href="/dreams">← {view.t.log}</Link>
      </div>
      {/* Dictation follows the ACCOUNT language, not the view. Someone who
          flipped the screen to English to show a friend must still be able to
          speak their next dream in their own language. */}
      <RecordFlow
        sequenceNo={seq}
        today={today}
        speakLang={view.accountLang}
        viewLang={view.lang}
      />
    </main>
  );
}
