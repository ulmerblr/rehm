// Force per-request server rendering so the timestamp advances on every reload.
export const dynamic = "force-dynamic";

export default function Home() {
  const serverTime = new Date().toISOString();

  return (
    <main>
      <h1>rehm — online</h1>
      <p>Server time: {serverTime}</p>
    </main>
  );
}
