"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Section links point at anchors on the home page. On any other route they
 * need the `/` prefix or they'd resolve against the current path and go
 * nowhere — hence the pathname check in the component below.
 */
const SECTIONS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#why-it-works", label: "Why it works" },
  { href: "#faq", label: "FAQ" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const onHome = pathname === "/";
  const hrefFor = (hash: string) => (onHome ? hash : `/${hash}`);

  // A menu left open while the route changes would hang over the new page.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-neutral-950/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5"
          onClick={() => setOpen(false)}
        >
          <Image
            src="/NexRoast-Logo.png"
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 rounded-full"
            priority
          />
          <span className="font-display text-lg font-bold tracking-tight text-white">
            NexRoast
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {SECTIONS.map((section) => (
            <a
              key={section.href}
              href={hrefFor(section.href)}
              className="rounded-full px-3.5 py-2 text-sm font-medium text-neutral-300 transition hover:bg-white/5 hover:text-white"
            >
              {section.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={onHome ? "#roast" : "/#roast"}
            className="rounded-full bg-gradient-to-r from-orange-500 to-red-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition active:scale-[0.97] sm:px-5"
          >
            Roast my site
          </a>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white transition hover:bg-white/5 md:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
              {open ? (
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              ) : (
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="site-menu"
          className="border-t border-white/10 bg-neutral-950/95 px-5 py-2 md:hidden"
        >
          {SECTIONS.map((section) => (
            <a
              key={section.href}
              href={hrefFor(section.href)}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-3 text-base font-medium text-neutral-200 transition hover:bg-white/5 hover:text-white"
            >
              {section.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}
