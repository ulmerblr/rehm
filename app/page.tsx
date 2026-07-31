import Link from "next/link";
import { requireUserId } from "@/lib/session";
import { listDreams } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const userId = await requireUserId();
  const dreams = await listDreams(userId);

  return (
    <main>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>rehm</h1>
        <Link href="/settings">Settings</Link>
      </div>
      <p className="muted">a longitudinal dream study</p>

      <div style={{ margin: "22px 0" }}>
        <Link href="/record" className="btn btn-primary btn-block btn-lg">
          Record a dream
        </Link>
      </div>

      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>Dreams</h2>
        <Link href="/trends">Trends →</Link>
      </div>

      {dreams.length === 0 ? (
        <p className="muted" style={{ marginTop: 16 }}>
          No dreams yet. Record your first one.
        </p>
      ) : (
        <div style={{ marginTop: 8 }}>
          {dreams.map((d) => (
            <Link key={d.id} href={`/dreams/${d.id}`} className="card card-link">
              <div className="seq">
                Dream {d.sequenceNo}
                {d.dreamtOn ? ` · ${d.dreamtOn}` : ""}
              </div>
              <div style={{ marginTop: 6 }}>{d.firstLine || "(no text)"}</div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
