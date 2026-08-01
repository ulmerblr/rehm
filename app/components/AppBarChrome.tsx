"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The auth pages carry their own wordmark and have nothing to navigate to.
const HIDE_ON = ["/login", "/signup"];

// A persistent frame: the wordmark in the testimony color, and who is signed
// in as a quiet mono stamp. No avatar — a second accent colour would compete
// with brass for no reason.
export default function AppBarChrome({ email }: { email: string | null }) {
  const pathname = usePathname() || "/";
  if (HIDE_ON.some((p) => pathname.startsWith(p))) return null;

  return (
    <header className="app-bar">
      <div className="app-bar-inner">
        <Link href="/" className="wordmark">
          rehm
        </Link>
        {email ? (
          <Link href="/settings" className="who">
            {email.split("@")[0]}
          </Link>
        ) : null}
      </div>
    </header>
  );
}
