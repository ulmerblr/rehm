"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LangToggle from "./LangToggle";
import type { Lang } from "@/lib/lang";

// The auth pages carry their own wordmark and have nothing to navigate to.
const HIDE_ON = ["/login", "/signup"];

// A persistent frame: the wordmark in the testimony color, and who is signed
// in as a quiet mono stamp. No avatar — a second accent colour would compete
// with brass for no reason.
export default function AppBarChrome({
  email,
  viewLang,
}: {
  email: string | null;
  viewLang: Lang | null;
}) {
  const pathname = usePathname() || "/";
  // Sign-in and sign-up carry their own wordmark and have no bar — but the
  // page still begins behind the status bar, so they get the inset on its own.
  if (HIDE_ON.some((p) => pathname.startsWith(p))) return <div className="safe-top" />;

  return (
    <header className="app-bar">
      <div className="app-bar-inner">
        <Link href="/" aria-label="rehmchi — home" className="lockup-link">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/lockup.png" alt="rehmchi" className="lockup" />
        </Link>
        <div className="app-bar-right">
          {viewLang && <LangToggle current={viewLang} />}
          {email ? (
            <Link href="/settings" className="who" title={email}>
              {email.split("@")[0]}
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
