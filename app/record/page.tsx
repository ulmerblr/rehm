import Link from "next/link";
import { requireUserId } from "@/lib/session";
import { nextSequenceNo } from "@/lib/queries";
import RecordFlow from "./RecordFlow";

export const dynamic = "force-dynamic";

export default async function Record() {
  const userId = await requireUserId();
  const seq = await nextSequenceNo(userId);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>Record</h1>
        <Link href="/">← Dreams</Link>
      </div>
      <RecordFlow sequenceNo={seq} today={today} />
    </main>
  );
}
