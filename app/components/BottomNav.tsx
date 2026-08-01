"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Fixed bottom navigation. Hidden on the auth pages, which are reached without a
// session and have nowhere to navigate to.
const HIDE_ON = ["/login", "/signup", "/setup"];

// Labels are passed in rather than hardcoded: the nav is a client component,
// and the dictionary lives on the server with the resolved view language.
export type NavLabels = {
  home: string;
  dreams: string;
  trends: string;
  settings: string;
};

const TABS = [
  { href: "/", key: "home", icon: "home" },
  { href: "/dreams", key: "dreams", icon: "moon" },
  { href: "/trends", key: "trends", icon: "trend" },
  { href: "/settings", key: "settings", icon: "gear" },
] as const;

function Icon({ name }: { name: (typeof TABS)[number]["icon"] }) {
  const common = {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V20a1 1 0 0 0 1 1h3v-6h6v6h3a1 1 0 0 0 1-1V9.5" />
        </svg>
      );
    case "moon":
      return (
        <svg {...common}>
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      );
    case "trend":
      return (
        <svg {...common}>
          <path d="M3 17l6-6 4 4 8-8" />
          <path d="M14 7h7v7" />
        </svg>
      );
    // Sliders, not a gear: a circle ringed by spokes collapses into a sunburst
    // at this size. Two tracks with offset knobs stay legible at 24px.
    case "gear":
      return (
        <svg {...common}>
          <path d="M3 8h8.4M16.6 8H21" />
          <circle cx="14" cy="8" r="2.6" />
          <path d="M3 16h4.4M12.6 16H21" />
          <circle cx="10" cy="16" r="2.6" />
        </svg>
      );
  }
}

export default function BottomNav({ labels }: { labels: NavLabels }) {
  const pathname = usePathname() || "/";
  if (HIDE_ON.some((p) => pathname.startsWith(p))) return null;

  return (
    <nav className="bottom-nav" aria-label="Main">
      {TABS.map((tab) => {
        // "/" matches only itself; the others match their whole section.
        const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={active ? "nav-tab nav-tab-on" : "nav-tab"}
            aria-current={active ? "page" : undefined}
          >
            <Icon name={tab.icon} />
            <span>{labels[tab.key]}</span>
          </Link>
        );
      })}
    </nav>
  );
}
