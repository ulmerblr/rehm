import Link from "next/link";

// The wordmark, left-aligned (~20px cap height), links to /. Light-on-dark to
// match the UI. Optional right-hand slot for page nav.
export default function Header({ right }: { right?: React.ReactNode }) {
  return (
    <div className="row" style={{ justifyContent: "space-between", marginBottom: 20 }}>
      <Link href="/" aria-label="rehm — home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/wordmark-light.svg" alt="rehm" style={{ height: 22, display: "block" }} />
      </Link>
      {right ?? null}
    </div>
  );
}
