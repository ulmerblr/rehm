"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Fixed bottom navigation. Hidden on the auth pages, which are reached without a
// session and have nowhere to navigate to.
const HIDE_ON = ["/login", "/signup"];

const TABS = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/dreams", label: "Dreams", icon: "moon" },
  { href: "/trends", label: "Trends", icon: "trend" },
  { href: "/settings", label: "Settings", icon: "gear" },
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
    case "gear":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3.2" />
          <path d="M12 2v2.5M12 19.5V22M22 12h-2.5M4.5 12H2M19.07 4.93l-1.77 1.77M6.7 17.3l-1.77 1.77M19.07 19.07 17.3 17.3M6.7 6.7 4.93 4.93" />
        </svg>
      );
  }
}

export default function BottomNav() {
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
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
