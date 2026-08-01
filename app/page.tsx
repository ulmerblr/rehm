import Link from "next/link";
import { requireUserId } from "@/lib/session";
import { listDreams, getUserEmail } from "@/lib/queries";
import Header from "@/app/components/Header";
import ProfileChip from "@/app/components/ProfileChip";

export const dynamic = "force-dynamic";

export default async function Home() {
  const userId = await requireUserId();
  const [dreams, email] = await Promise.all([listDreams(userId), getUserEmail(userId)]);

  return (
    <main>
      <Header right={<ProfileChip email={email} />} />

      <Link href="/record" className="btn btn-primary btn-block btn-lg" style={{ marginTop: 4 }}>
        Record a dream
      </Link>

      <div className="row section-head" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>
          Your dreams{dreams.length > 0 ? ` · ${dreams.length}` : ""}
        </h2>
        <Link href="/trends">Trends →</Link>
      </div>

      {dreams.length === 0 ? (
        <div className="card" style={{ textAlign: "center" }}>
          <p className="muted" style={{ margin: 0 }}>
            No dreams yet. Tap <strong>Record a dream</strong> to capture your first one.
          </p>
        </div>
      ) : (
        <div className="stack" style={{ marginTop: 8 }}>
          {dreams.map((d) => (
            <Link key={d.id} href={`/dreams/${d.id}`} className="card card-link" style={{ margin: 0 }}>
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
