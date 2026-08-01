"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ProfileChip from "./ProfileChip";

// The auth pages carry their own large wordmark and have nothing to navigate
// to, so the bar would be redundant chrome there.
const HIDE_ON = ["/login", "/signup"];

// A persistent top bar. It sits on every signed-in page so the wordmark and the
// signed-in identity never appear or vanish depending on where you are, and its
// surface + border give the content something to scroll under instead of
// bleeding into the top of the page.
export default function AppBarChrome({ email }: { email: string | null }) {
  const pathname = usePathname() || "/";
  if (HIDE_ON.some((p) => pathname.startsWith(p))) return null;

  return (
    <header className="app-bar">
      <div className="app-bar-inner">
        <Link href="/" aria-label="rehm — home" className="app-bar-mark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/wordmark-light.svg" alt="rehm" />
        </Link>
        {email ? <ProfileChip email={email} /> : null}
      </div>
    </header>
  );
}
